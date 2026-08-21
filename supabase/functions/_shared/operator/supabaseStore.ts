import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';
import type { OwnerApprovalRequest } from '../../../../src/operator/approval.ts';
import { redactSecrets } from '../../../../src/operator/redaction.ts';
import type { ScheduledCycleReport, ScheduledOperatorStore, ScheduledRunContext } from '../../../../src/operator/scheduledRunner.ts';
import type { ContentCandidate, HealthScore, ProviderRunSnapshot, ProviderSnapshot } from '../../../../src/operator/types.ts';

type JsonObject = Record<string, unknown>;

export function createSupabaseOperatorStore(client: SupabaseClient): ScheduledOperatorStore {
  return {
    async beginRun(mode, now, scheduled) {
      const runId=crypto.randomUUID(),taskId=crypto.randomUUID(),stage=mode==='source_hunt'?'source_discovery':'quality_review',agent=mode==='source_hunt'?'source_discovery':'orchestrator';
      await must(client.from('city_expansion_runs').insert({id:runId,workflow_type:'city_expansion',city_id:mode==='source_hunt'?'tel_aviv':'global',status:'running',current_stage:stage,risk_level:'low',autonomy_level:2,created_at:now.toISOString(),updated_at:now.toISOString()}));
      await must(client.from('agent_tasks').insert({id:taskId,run_id:runId,agent,stage,status:'running',input_summary:{operatorMode:mode,scheduled,greenOnly:true},tools_used:['unified_operator','production_read_only'],approval_required:false,started_at:now.toISOString()}));
      return {runId,taskId};
    },
    async loadContent() {
      const {data,error}=await client.from('active_event_occurrences').select('occurrence_id,city_id,provider,title,description,starts_at,ends_at,category,age_min_months,age_max_months,price_note,latitude,longitude,source_url,registration_url,event_status,occurrence_fingerprint');
      if(error)throw error; return (data??[]).map(mapContent);
    },
    async loadProviders() {
      const [{data:providers,error:providerError},{data:runs,error:runError},{data:snapshot,error:snapshotError}]=await Promise.all([
        client.from('provider_registry').select('key,city_id,enabled,schedule_cron').eq('enabled',true),
        client.from('provider_sync_runs').select('provider,status,source_complete,source_records_fetched,normalized,duplicates,errors,archived,started_at,completed_at').order('started_at',{ascending:false}).limit(200),
        client.rpc('operator_health_snapshot'),
      ]);
      if(providerError)throw providerError;if(runError)throw runError;if(snapshotError)throw snapshotError;
      const cronMatches=((snapshot as JsonObject)?.providerCronMatches??{}) as Record<string,number>;
      return (providers??[]).map((provider):ProviderSnapshot=>({key:provider.key,cityId:provider.city_id,enabled:provider.enabled,scheduleCron:provider.schedule_cron,cronActive:Number(cronMatches[provider.key]??0)>0,cronMatches:Number(cronMatches[provider.key]??0),intentionallyParked:provider.key==='tel_aviv_port',runs:(runs??[]).filter((run)=>run.provider===provider.key).slice(0,12).map(mapProviderRun)}));
    },
    async loadLatestProductHealth() {
      const {data,error}=await client.from('agent_artifacts').select('payload').eq('artifact_type','unified_operator_report').order('created_at',{ascending:false}).limit(20);if(error)throw error;
      for(const row of data??[]){const health=(row.payload as JsonObject)?.productHealth as HealthScore|undefined;if(health&&Number.isFinite(health.score))return health;}return null;
    },
    async checkUrls(urls,now){const unique=[...new Set(urls)].sort();if(!unique.length)return new Set();const batchSize=50,start=(Math.floor(now.getTime()/86_400_000)*batchSize)%unique.length,batch=Array.from({length:Math.min(batchSize,unique.length)},(_,index)=>unique[(start+index)%unique.length]);const broken=new Set<string>();for(let offset=0;offset<batch.length;offset+=10)await Promise.all(batch.slice(offset,offset+10).map(async(url)=>{try{const result=await fetch(url,{method:'HEAD',redirect:'follow',signal:AbortSignal.timeout(6000)});if(result.status>=400&&result.status!==403&&result.status!==405)broken.add(url);}catch{broken.add(url);}}));return broken;},
    async loadPendingApprovalKeys() {const {data,error}=await client.from('approval_requests').select('operator_key').eq('status','PENDING').not('operator_key','is',null);if(error)throw error;return new Set((data??[]).map((row)=>row.operator_key).filter(Boolean));},
    async createApproval(request,key) {const source=request.category==='new_source';await must(client.from('approval_requests').insert({id:request.approvalId,run_id:request.runId,gate:source?'new_source':'global_quality_or_dedupe',decision_required:request.recommendedAction,risk_summary:{operatorKey:key,riskLevel:request.riskLevel,whyNow:request.whyNow,expectedImpact:request.expectedImpact,rollbackPlan:request.rollbackPlan,agentRecommendation:request.agentRecommendation},proposed_changes:{recommendedAction:request.recommendedAction},evidence:redactSecrets(request.evidence),dry_run_results:redactSecrets(request.dryRunResults),requested_by_agent:source?'source_discovery':'orchestrator',status:'PENDING',category:request.category,title:request.title,summary:request.summary,why_now:request.whyNow,recommended_action:request.recommendedAction,risk_level:request.riskLevel,expected_impact:request.expectedImpact,rollback_plan:request.rollbackPlan,agent_recommendation:request.agentRecommendation,operator_key:key,created_at:request.createdAt}));},
    async completeRun(context,report){await must(client.from('agent_artifacts').insert({id:crypto.randomUUID(),run_id:context.runId,task_id:context.taskId,artifact_type:'unified_operator_report',schema_version:'2.0',payload:redactSecrets(report),content_hash:context.runId,created_by_agent:report.mode==='source_hunt'?'source_discovery':'orchestrator'}));await must(client.from('agent_tasks').update({status:'completed',output_summary:{productHealth:report.productHealth,contentHealth:report.contentHealth,findings:report.findings.length,approvalsCreated:report.approvalsCreated.length},confidence:95,finished_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',context.taskId));await must(client.from('city_expansion_runs').update({status:'completed',updated_at:new Date().toISOString()}).eq('id',context.runId));},
    async failRun(context,error){const safe=String(redactSecrets(error)).slice(0,200);await client.from('agent_artifacts').insert({id:crypto.randomUUID(),run_id:context.runId,task_id:context.taskId,artifact_type:'unified_operator_failure',schema_version:'2.0',payload:{error:safe},content_hash:context.runId,created_by_agent:'orchestrator'});await client.from('agent_tasks').update({status:'failed',error_code:safe,finished_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',context.taskId);await client.from('city_expansion_runs').update({status:'failed',updated_at:new Date().toISOString()}).eq('id',context.runId);},
  };
}

function mapContent(row:Record<string,unknown>):ContentCandidate{return{id:String(row.occurrence_id),cityId:String(row.city_id),provider:String(row.provider),title:String(row.title),description:nullableString(row.description),startsAt:String(row.starts_at),endsAt:nullableString(row.ends_at),category:nullableString(row.category),ageMinMonths:nullableNumber(row.age_min_months),ageMaxMonths:nullableNumber(row.age_max_months),priceNote:nullableString(row.price_note),latitude:nullableNumber(row.latitude),longitude:nullableNumber(row.longitude),sourceUrl:nullableString(row.source_url),registrationUrl:nullableString(row.registration_url),eventStatus:nullableString(row.event_status),occurrenceFingerprint:nullableString(row.occurrence_fingerprint)};}
function mapProviderRun(row:Record<string,unknown>):ProviderRunSnapshot{return{provider:String(row.provider),status:String(row.status) as ProviderRunSnapshot['status'],sourceComplete:Boolean(row.source_complete),fetched:Number(row.source_records_fetched??0),normalized:Number(row.normalized??0),duplicates:Number(row.duplicates??0),invalidOrErrors:Number(row.errors??0),archived:Number(row.archived??0),startedAt:String(row.started_at),completedAt:nullableString(row.completed_at)};}
function nullableString(value:unknown):string|null{return typeof value==='string'?value:null;}function nullableNumber(value:unknown):number|null{return typeof value==='number'&&Number.isFinite(value)?value:null;}
async function must(result:PromiseLike<{error:unknown}>):Promise<void>{const {error}=await result;if(error)throw error;}
