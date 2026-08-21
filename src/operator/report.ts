import type { HealthScore, OperatorFinding } from './types.ts';

export interface OperatorReportInput {
  productHealth: HealthScore;
  contentHealth: HealthScore;
  topFindings: OperatorFinding[];
  providerSummaries: Record<string, { score: number }>;
  cityScores: Record<string, HealthScore>;
  opportunities?: Array<{ name: string }>;
  completed?: string[];
  approvals?: string[];
}

export function formatOperatorReport(input: OperatorReportInput): string {
  const findings = (domain: OperatorFinding['domain']) => input.topFindings
    .filter((finding) => finding.domain === domain)
    .map((finding) => `- ${finding.priority}: ${finding.title}`);
  const section = (title: string, rows: string[]) => `${title}:\n${rows.length ? rows.join('\n') : '- None'}`;
  const next = input.topFindings[0]?.title ?? input.opportunities?.[0]?.name ?? 'Continue supervised monitoring';
  return [
    'NESTUP OPERATOR REPORT',
    `OVERALL:\nProduct Health: ${input.productHealth.score}/100\nContent Health: ${input.contentHealth.score}/100`,
    section('CRITICAL', input.topFindings.filter((finding) => finding.priority === 'P0').map((finding) => `- ${finding.title}`)),
    section('PRODUCT', findings('product')),
    section('CONTENT', findings('content')),
    section('PROVIDERS', Object.entries(input.providerSummaries).map(([provider, health]) => `- ${provider}: ${health.score}/100`)),
    section('CITY COVERAGE', Object.entries(input.cityScores).map(([city, health]) => `- ${city}: ${health.score}/100`)),
    section('NEW OPPORTUNITIES', (input.opportunities ?? []).slice(0, 3).map((item) => `- ${item.name}`)),
    section('AUTONOMOUS FIXES COMPLETED', input.completed ?? []),
    section('WAITING FOR APPROVAL', input.approvals ?? []),
    `NEXT BEST ACTION:\n- ${next}`,
  ].join('\n\n');
}
