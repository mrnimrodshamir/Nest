import type { OperatorFinding, ProviderSnapshot } from './types.ts';

export interface ProviderHealthResult { score: number; findings: OperatorFinding[]; reasons: string[] }

export function assessProviderHealth(provider: ProviderSnapshot, now = new Date()): ProviderHealthResult {
  const findings: OperatorFinding[] = [];
  const latest = [...provider.runs].sort((a, b) => Date.parse(b.startedAt) - Date.parse(a.startedAt))[0];
  if (provider.intentionallyParked) {
    return { score: 60, findings: [], reasons: ['Intentionally parked after known upstream HTTP 403; unchanged state is not a new incident'] };
  }
  if (!latest) findings.push(issue(provider, 'no-runs', 'P1', 'Provider has no sync evidence', 'No provider_sync_runs row exists', 8));
  else {
    const ageHours = (now.getTime() - Date.parse(latest.startedAt)) / 3_600_000;
    if (latest.status !== 'success' || !latest.sourceComplete) findings.push(issue(provider, 'latest-failed', 'P1', 'Latest provider run is unhealthy', `${latest.status}; sourceComplete=${latest.sourceComplete}`, 9));
    if (latest.fetched === 0) findings.push(issue(provider, 'zero', 'P1', 'Provider returned zero records', 'Latest fetched count is zero', 9));
    if (ageHours > 36 && provider.scheduleCron) findings.push(issue(provider, 'stale', 'P1', 'Scheduled provider is stale', `Last run is ${Math.round(ageHours)} hours old`, 8));
    if (latest.archived > Math.max(10, latest.normalized * 0.25)) findings.push(issue(provider, 'archive-spike', 'P1', 'Provider archive spike', `${latest.archived} archived from ${latest.normalized} normalized`, 9));
  }
  if (provider.scheduleCron && !provider.cronActive) findings.push(issue(provider, 'cron-missing', 'P0', 'Configured provider cron is missing', provider.scheduleCron, 10));
  if ((provider.cronMatches ?? 0) > 1) findings.push(issue(provider, 'cron-duplicate', 'P0', 'Provider has duplicate active cron paths', `${provider.cronMatches} matching jobs`, 10));
  if (!provider.scheduleCron && provider.cronActive) findings.push(issue(provider, 'cron-unowned', 'P1', 'Provider has an unregistered cron', provider.key, 9));
  const score = Math.max(0, 100 - findings.reduce((sum, finding) => sum + (finding.priority === 'P0' ? 35 : finding.priority === 'P1' ? 20 : 8), 0));
  return { score, findings, reasons: findings.map((finding) => finding.evidence) };
}

function issue(provider: ProviderSnapshot, suffix: string, priority: OperatorFinding['priority'], title: string, evidence: string, severity: number): OperatorFinding {
  return { id: `${provider.key}:${suffix}`, domain: 'provider', priority, title, evidence, severity, userImpact: 8, confidence: 10, reach: 7, implementationRisk: 4, autonomy: 'YELLOW' };
}
