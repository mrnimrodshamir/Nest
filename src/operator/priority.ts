import type { OperatorFinding } from './types.ts';

const PRIORITY_ORDER = { P0: 4, P1: 3, P2: 2, P3: 1 } as const;

export function priorityScore(finding: OperatorFinding): number {
  const risk = Math.max(1, finding.implementationRisk);
  return round((finding.severity * finding.userImpact * finding.confidence * finding.reach) / risk);
}

export function prioritize(findings: OperatorFinding[], limit = 5): OperatorFinding[] {
  return findings.map((finding) => ({ ...finding, score: priorityScore(finding) }))
    .sort((a, b) => PRIORITY_ORDER[b.priority] - PRIORITY_ORDER[a.priority] || (b.score ?? 0) - (a.score ?? 0) || a.id.localeCompare(b.id))
    .slice(0, limit);
}

function round(value: number): number { return Math.round(value * 100) / 100; }
