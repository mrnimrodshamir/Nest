import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { linkedQuery, sqlJson } from './lib/supabase-query.mjs';
import { createOperatorPlan } from '../src/operator/orchestrator.ts';
import { assessProviderHealth } from '../src/operator/providerHealth.ts';
import { auditContent } from '../src/operator/contentQuality.ts';
import { contentHealth } from '../src/operator/scoring.ts';
import { productHealth } from '../src/operator/scoring.ts';
import { prioritize } from '../src/operator/priority.ts';
import { rankSourceOpportunities } from '../src/operator/sourceHunt.ts';
import { redactSecrets } from '../src/operator/redaction.ts';
import { resolveCityForCoordinate } from '../src/config/cities.ts';
import { formatOperatorReport } from '../src/operator/report.ts';

const mode = value('--mode') ?? 'quick_check';
const persist = process.argv.includes('--persist');
if (!['quick_check','daily','deep_audit','city_expansion','source_hunt','bug_hunt','content_audit'].includes(mode)) throw new Error(`Unsupported mode: ${mode}`);
const plan = createOperatorPlan(mode === 'content_audit' ? 'daily' : mode);
let report;
if (mode === 'source_hunt') report = await runSourceHunt();
else report = await runHealth(mode === 'content_audit');
const safeReport = redactSecrets({ schemaVersion:'1.0', generatedAt:new Date().toISOString(), mode, plan, ...report });
const outputDir = resolve('docs/operator/runs'); await mkdir(outputDir,{recursive:true});
const output = resolve(outputDir, `${new Date().toISOString().replace(/[:.]/g,'-')}-${mode}.json`);
await writeFile(output, `${JSON.stringify(safeReport,null,2)}\n`, 'utf8');
let runId = null;
if (persist) runId = await persistRun(mode,safeReport);
console.log(JSON.stringify({ mode, output, persisted:persist, runId, summary: safeReport.summary ?? null },null,2));

async function runHealth(contentOnly) {
  const [providerRow] = await linkedQuery(`select coalesce(json_agg(x order by key),'[]'::json) as providers from (select p.key,p.city_id,p.enabled,p.schedule_cron,(select count(*) from cron.job j where j.active and (j.schedule=p.schedule_cron or j.jobname ilike '%'||replace(p.key,'_','-')||'%' or j.command ilike '%'||p.key||'%')) cron_matches,coalesce((select json_agg(r order by r.started_at desc) from (select provider,status,source_complete,source_records_fetched fetched,normalized,duplicates,errors invalid_or_errors,archived,started_at,completed_at from public.provider_sync_runs where provider=p.key order by started_at desc limit 12) r),'[]'::json) runs from public.provider_registry p where p.key<>'givatayim_municipality') x;`);
  const [contentRow] = await linkedQuery(`select coalesce(json_agg(json_build_object('id',a.occurrence_id,'cityId',a.city_id,'provider',a.provider,'title',a.title,'description',a.description,'startsAt',a.starts_at,'endsAt',a.ends_at,'category',a.category,'ageMinMonths',a.age_min_months,'ageMaxMonths',a.age_max_months,'priceNote',a.price_note,'latitude',a.latitude,'longitude',a.longitude,'sourceUrl',e.source_url,'registrationUrl',a.registration_url,'eventStatus',a.event_status,'occurrenceFingerprint',a.occurrence_fingerprint)),'[]'::json) as events from public.active_event_occurrences a join public.events e on e.id=a.event_id;`);
  const [opsRow] = await linkedQuery(`select json_build_object('dailyCron',(select count(*) from cron.job where active and jobname='send-daily-digest-jerusalem-0700'),'weeklyCron',(select count(*) from cron.job where active and jobname='send-weekly-digest-jerusalem-1900'),'agentTablesRls',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname in('city_expansion_runs','agent_tasks','agent_artifacts','agent_decisions','approval_requests') and c.relrowsecurity),'agentPublicGrants',(select count(*) from information_schema.role_table_grants where table_schema='public' and table_name in('city_expansion_runs','agent_tasks','agent_artifacts','agent_decisions','approval_requests') and grantee in('anon','authenticated')),'digestUniqueIndexes',(select count(*) from pg_indexes where schemaname='public' and indexname in('daily_digest_instances_identity_idx','daily_digest_sends_logical_identity_idx')),'publicTablesWithoutRls',(select count(*) from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relname<>'spatial_ref_sys' and not c.relrowsecurity),'publicProfileForbiddenColumns',(select count(*) from information_schema.columns where table_schema='public' and table_name='public_profiles' and column_name in('email','phone','birthdate','date_of_birth','latitude','longitude')),'eventAttendeePolicies',(select count(*) from pg_policies where schemaname='public' and tablename='event_attendees')) as operations;`);
  const providers=(providerRow.providers??[]).map((row)=>({key:row.key,cityId:row.city_id,enabled:row.enabled,scheduleCron:row.schedule_cron,cronActive:Number(row.cron_matches)>0,cronMatches:Number(row.cron_matches),intentionallyParked:row.key==='tel_aviv_port',runs:(row.runs??[]).map((run)=>({provider:run.provider,status:run.status,sourceComplete:run.source_complete,fetched:run.fetched,normalized:run.normalized,duplicates:run.duplicates,invalidOrErrors:run.invalid_or_errors,archived:run.archived,startedAt:run.started_at,completedAt:run.completed_at}))}));
  const events=contentRow.events??[];
  const brokenUrls=process.argv.includes('--check-urls')?await checkUrls(events.flatMap((event)=>[event.sourceUrl,event.registrationUrl]).filter(Boolean)):new Set();
  const content=auditContent(events,new Date(),{resolveCity:(latitude,longitude)=>resolveCityForCoordinate(latitude,longitude),brokenUrls});
  const providerResults=Object.fromEntries(providers.map((provider)=>[provider.key,assessProviderHealth(provider)]));
  const providerFindings=Object.values(providerResults).flatMap((result)=>result.findings);
  const cityScores=Object.fromEntries([...new Set(events.map((event)=>event.cityId))].map((city)=>[city,scoreContent(events.filter((event)=>event.cityId===city))]));
  const providerScores=Object.fromEntries([...new Set(events.map((event)=>event.provider))].map((provider)=>[provider,scoreContent(events.filter((event)=>event.provider===provider))]));
  const globalScore=scoreContent(events);
  const top5=prioritize([...content.issues,...providerFindings]);
  const validationPath=value('--validation'); const validation=validationPath?JSON.parse(await readFile(resolve(validationPath),'utf8')):{};
  const ops=opsRow.operations??{}; const securityBase=ops.agentTablesRls===5&&ops.agentPublicGrants===0&&ops.digestUniqueIndexes===2&&ops.publicTablesWithoutRls===0&&ops.publicProfileForbiddenColumns===0&&ops.eventAttendeePolicies>=3; const product=productHealth({tests:pass(validation.tests),typeScript:pass(validation.typeScript),expoDoctor:ratio(validation.expoDoctorPassed,validation.expoDoctorTotal),iosExport:pass(validation.iosExport),criticalFlows:ratio(validation.criticalFlowPassed,validation.criticalFlowTotal),edgeFunctions:providers.every((provider)=>provider.intentionallyParked||provider.runs[0]?.status==='success')?1:0,cronHealth:providers.every((provider)=>!provider.scheduleCron||provider.cronMatches===1)&&ops.dailyCron===1&&ops.weeklyCron===1?1:0,security:securityBase?Math.max(0,Math.min(1,Number(validation.securityScore??pass(validation.securityTests)))):0});
  const dailyReport=formatOperatorReport({productHealth:product,contentHealth:globalScore,topFindings:top5,providerSummaries:Object.fromEntries(Object.entries(providerResults).map(([key,result])=>[key,{score:result.score}])),cityScores,completed:['Read-only diagnostics and regression coverage'],approvals:top5.filter((finding)=>finding.autonomy!=='GREEN').map((finding)=>finding.title)});
  return { summary:{eventsChecked:content.checked,contentHealth:globalScore.score,productHealth:product.score,providersChecked:providers.length,topIssues:top5.length},productHealth:product,operations:ops,contentAudit:content,contentHealth:{global:globalScore,cities:cityScores,providers:providerScores},providerHealth:providerResults,top5,dailyReport,contentOnly };
}

async function runSourceHunt() {
  const inputPath=value('--input'); if(!inputPath) throw new Error('--input is required for source_hunt');
  const input=JSON.parse(await readFile(resolve(inputPath),'utf8')); const ranked=rankSourceOpportunities(input.sources);
  return {summary:{city:input.city,candidates:ranked.length,top:ranked[0]?.name??null},city:input.city,question:input.question,currentCoverage:input.currentCoverage,sources:ranked};
}

function scoreContent(events) { const count=Math.max(1,events.length); const ratio=(predicate)=>events.filter(predicate).length/count; return contentHealth({sourceCompleteness:1,freshness:1,validity:ratio((e)=>Number.isFinite(Date.parse(e.startsAt))),uniqueness:1-auditContent(events).duplicateGroups.reduce((sum,g)=>sum+g.length,0)/count,familyRelevance:1,ageCoverage:ratio((e)=>e.ageMinMonths!=null||e.ageMaxMonths!=null),priceCoverage:ratio((e)=>Boolean(e.priceNote)),locationCoverage:ratio((e)=>e.latitude!=null&&e.longitude!=null),registrationCoverage:ratio((e)=>Boolean(e.registrationUrl||e.sourceUrl)),categoryConfidence:ratio((e)=>Boolean(e.category&&e.category!=='other'))}); }

async function persistRun(runMode,payload) { const runId=randomUUID(), taskId=randomUUID(), artifactId=randomUUID(); const stage=runMode==='source_hunt'?'source_discovery':'quality_review'; const agent=runMode==='source_hunt'?'source_discovery':runMode==='content_audit'?'event_quality':'orchestrator'; const city=runMode==='source_hunt'?'tel_aviv':'global'; await linkedQuery(`begin; insert into public.city_expansion_runs(id,workflow_type,city_id,status,current_stage,risk_level,autonomy_level) values('${runId}','city_expansion','${city}','completed','${stage}','low',2); insert into public.agent_tasks(id,run_id,agent,stage,status,input_summary,output_summary,tools_used,confidence,approval_required,started_at,finished_at) values('${taskId}','${runId}','${agent}','${stage}','completed',${sqlJson({operatorMode:runMode,readOnly:true})},${sqlJson(payload.summary??{})},array['unified_operator','production_read_only'],95,false,now(),now()); insert into public.agent_artifacts(id,run_id,task_id,artifact_type,payload,content_hash,created_by_agent) values('${artifactId}','${runId}','${taskId}','unified_operator_report',${sqlJson(payload)},'${runId}','${agent}'); commit;`); return runId; }
function value(flag){const index=process.argv.indexOf(flag);return index>=0?process.argv[index+1]:null;}
function pass(value){return value===true?1:0;}
function ratio(value,total){return Number(total)>0?Math.max(0,Math.min(1,Number(value)/Number(total))):0;}
async function checkUrls(values){const urls=[...new Set(values)].slice(0,500),broken=new Set();for(let offset=0;offset<urls.length;offset+=12){await Promise.all(urls.slice(offset,offset+12).map(async(url)=>{try{const response=await fetch(url,{method:'HEAD',redirect:'follow',signal:AbortSignal.timeout(8000)});if(response.status>=400&&response.status!==403&&response.status!==405)broken.add(url);}catch{broken.add(url);}}));}return broken;}
