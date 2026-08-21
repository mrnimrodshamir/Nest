import { assertApprovalRequired, type OwnerApprovalRequest } from './approval.ts';
import { auditContent } from './contentQuality.ts';
import { assessProviderHealth } from './providerHealth.ts';
import { prioritize } from './priority.ts';
import { scoreContentCandidates } from './scoring.ts';
import { assertScheduledMode } from './schedule.ts';
import { rankSourceOpportunities, type SourceOpportunity } from './sourceHunt.ts';
import type { ContentCandidate, HealthScore, OperatorFinding, OperatorMode, ProviderSnapshot } from './types.ts';

export interface ScheduledRunContext { runId: string; taskId: string }
export interface ScheduledOperatorStore {
  beginRun(mode: 'daily' | 'source_hunt', now: Date): Promise<ScheduledRunContext>;
  loadContent(): Promise<ContentCandidate[]>;
  loadProviders(): Promise<ProviderSnapshot[]>;
  loadLatestProductHealth(): Promise<HealthScore | null>;
  checkUrls(urls: string[], now: Date): Promise<Set<string>>;
  loadPendingApprovalKeys(): Promise<Set<string>>;
  createApproval(request: OwnerApprovalRequest, key: string): Promise<void>;
  completeRun(context: ScheduledRunContext, report: ScheduledCycleReport): Promise<void>;
  failRun(context: ScheduledRunContext, error: string): Promise<void>;
}

export interface ScheduledCycleReport {
  mode: 'daily' | 'source_hunt';
  generatedAt: string;
  status: 'completed';
  productHealth: number | null;
  contentHealth: number | null;
  findings: OperatorFinding[];
  providerHealth: Record<string, number>;
  opportunities: ReturnType<typeof rankSourceOpportunities>;
  approvalsCreated: Array<{ key: string; approvalId: string; title: string }>;
  autonomousFixes: string[];
  ownerReport: string;
}

export interface ScheduledRunnerOptions {
  now?: Date;
  sourceCatalog?: SourceOpportunity[];
  idFactory?: () => string;
}

export async function runScheduledOperator(mode: OperatorMode, store: ScheduledOperatorStore, options: ScheduledRunnerOptions = {}): Promise<ScheduledCycleReport> {
  assertScheduledMode(mode);
  const now = options.now ?? new Date();
  const idFactory = options.idFactory ?? (() => crypto.randomUUID());
  const context = await store.beginRun(mode, now);
  try {
    const pending = await store.loadPendingApprovalKeys();
    const report = mode === 'daily'
      ? await dailyCycle(store, context, pending, now, idFactory)
      : await sourceCycle(store, context, pending, now, idFactory, options.sourceCatalog ?? []);
    await store.completeRun(context, report);
    return report;
  } catch (error) {
    await store.failRun(context, safeError(error));
    throw error;
  }
}

async function dailyCycle(store: ScheduledOperatorStore, context: ScheduledRunContext, pending: Set<string>, now: Date, idFactory: () => string): Promise<ScheduledCycleReport> {
  const [events, providers, product] = await Promise.all([store.loadContent(), store.loadProviders(), store.loadLatestProductHealth()]);
  const brokenUrls=await store.checkUrls(events.flatMap((event)=>[event.sourceUrl,event.registrationUrl]).filter((url):url is string=>Boolean(url)),now);
  const audit = auditContent(events, now, {brokenUrls});
  const findings = prioritize([...audit.issues, ...providers.flatMap((provider) => assessProviderHealth(provider, now).findings)]);
  const providerHealth = Object.fromEntries(providers.map((provider) => [provider.key, assessProviderHealth(provider, now).score]));
  const approvalsCreated = await createFindingApprovals(store, context.runId, findings, pending, now, idFactory);
  const contentHealth=scoreContentCandidates(events).score,visible=visibleQueue(findings);
  return { mode: 'daily', generatedAt: now.toISOString(), status: 'completed', productHealth: product?.score ?? null, contentHealth, findings: visible, providerHealth, opportunities: [], approvalsCreated, autonomousFixes: [], ownerReport:formatScheduledOwnerReport(product?.score??null,contentHealth,visible,providerHealth,[],approvalsCreated) };
}

async function sourceCycle(store: ScheduledOperatorStore, context: ScheduledRunContext, pending: Set<string>, now: Date, idFactory: () => string, catalog: SourceOpportunity[]): Promise<ScheduledCycleReport> {
  const brokenUrls=await store.checkUrls(catalog.map((source)=>source.officialUrl),now);
  const opportunities = rankSourceOpportunities(catalog.filter((source)=>!brokenUrls.has(source.officialUrl)));
  const findings:OperatorFinding[]=[...brokenUrls].map((url,index)=>({id:`coverage:broken-source-${index}`,domain:'coverage',priority:'P2',title:'Official source candidate is unreachable',evidence:url,severity:5,userImpact:3,confidence:8,reach:2,implementationRisk:2,autonomy:'GREEN'}));
  const approvalsCreated: ScheduledCycleReport['approvalsCreated'] = [];
  for (const opportunity of opportunities.filter((item) => item.recommendedPriority === 'P1').slice(0, 3)) {
    const key = `new_source:${opportunity.id}`;
    if (pending.has(key)) continue;
    const request = approvalFromSource(context.runId, opportunity, now, idFactory());
    await store.createApproval(request, key);
    approvalsCreated.push({ key, approvalId: request.approvalId, title: request.title });
  }
  return { mode: 'source_hunt', generatedAt: now.toISOString(), status: 'completed', productHealth: null, contentHealth: null, findings, providerHealth: {}, opportunities, approvalsCreated, autonomousFixes: [], ownerReport:formatScheduledOwnerReport(null,null,findings,{},opportunities,approvalsCreated) };
}

async function createFindingApprovals(store: ScheduledOperatorStore, runId: string, findings: OperatorFinding[], pending: Set<string>, now: Date, idFactory: () => string): Promise<ScheduledCycleReport['approvalsCreated']> {
  const created: ScheduledCycleReport['approvalsCreated'] = [];
  for (const finding of visibleQueue(findings).filter((item) => item.autonomy === 'YELLOW' && (item.priority === 'P0' || item.priority === 'P1')).slice(0, 3)) {
    assertApprovalRequired(finding.autonomy);
    const key = `content_quality:${finding.id}`;
    if (pending.has(key)) continue;
    const request: OwnerApprovalRequest = { approvalId:idFactory(), runId, category:'production_content_correction', title:finding.title, summary:finding.evidence, whyNow:`Detected during the scheduled operator cycle at priority ${finding.priority}`, recommendedAction:'Review the affected records and approve a scoped correction plan', riskLevel:finding.priority==='P0'?'high':'medium', evidence:{findingId:finding.id,priority:finding.priority,evidence:finding.evidence}, dryRunResults:{productionWrites:0}, expectedImpact:'Remove misleading or low-quality content without changing unrelated records', rollbackPlan:'No production correction is executed until approval; any approved change must include record-level rollback SQL', agentRecommendation:'APPROVE', createdAt:now.toISOString(), status:'PENDING' };
    await store.createApproval(request,key); created.push({key,approvalId:request.approvalId,title:request.title});
  }
  return created;
}

function approvalFromSource(runId: string, opportunity: ReturnType<typeof rankSourceOpportunities>[number], now: Date, approvalId: string): OwnerApprovalRequest {
  return { approvalId, runId, category:'new_source', title:`Evaluate ${opportunity.name}`, summary:`Official ${opportunity.contentType} source with an estimated ${opportunity.estimatedWeeklyNetNew} net-new events per week`, whyNow:'The Tel Aviv coverage audit identified a current family-content gap', recommendedAction:'Approve a provider-neutral connector dry run; do not enable production sync', riskLevel:opportunity.operationalRisk>=1?'medium':'low', evidence:{officialUrl:opportunity.officialUrl,overlapPercent:opportunity.overlapPercent,structure:opportunity.structure,score:opportunity.score}, dryRunResults:{productionWrites:0,integrationPerformed:false}, expectedImpact:`Approximately ${opportunity.estimatedWeeklyNetNew} net-new family events per week before duplicate filtering`, rollbackPlan:'No provider or cron exists; reject the proposal or remove the unmerged connector draft', agentRecommendation:'APPROVE', createdAt:now.toISOString(), status:'PENDING' };
}

function visibleQueue(findings: OperatorFinding[]): OperatorFinding[] {
  const urgent = findings.filter((finding) => finding.priority === 'P0' || finding.priority === 'P1');
  const later = findings.filter((finding) => finding.priority === 'P2' || finding.priority === 'P3').slice(0, Math.max(0, 5 - urgent.length));
  return [...urgent, ...later].slice(0, 5);
}

function safeError(error: unknown): string { return error instanceof Error ? error.message.slice(0, 200) : 'Scheduled operator failed'; }

function formatScheduledOwnerReport(product:number|null,content:number|null,findings:OperatorFinding[],providers:Record<string,number>,opportunities:ReturnType<typeof rankSourceOpportunities>,approvals:ScheduledCycleReport['approvalsCreated']):string{
  const rows=(values:string[])=>values.length?values.map((value)=>`- ${value}`).join('\n'):'- None';
  return ['NESTUP OPERATOR REPORT',`Overall:\nProduct Health: ${product??'Not measured'}\nContent Health: ${content??'Not measured'}`,`Critical:\n${rows(findings.filter((finding)=>finding.priority==='P0'||finding.priority==='P1').map((finding)=>`${finding.priority}: ${finding.title}`))}`,'Fixed autonomously:\n- None',`Content issues:\n${rows(findings.filter((finding)=>finding.domain==='content').map((finding)=>finding.title))}`,`Provider health:\n${rows(Object.entries(providers).map(([provider,score])=>`${provider}: ${score}/100`))}`,`New Tel Aviv opportunities:\n${rows(opportunities.slice(0,3).map((source)=>source.name))}`,`Waiting for approval:\n${rows(approvals.map((approval)=>approval.title))}`,`Recommended next action:\n- ${approvals[0]?.title??findings[0]?.title??opportunities[0]?.name??'Continue monitoring'}`].join('\n\n');
}
