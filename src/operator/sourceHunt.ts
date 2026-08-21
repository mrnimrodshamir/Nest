export interface SourceOpportunity {
  id: string;
  name: string;
  officialUrl: string;
  contentType: string;
  estimatedWeeklyNetNew: number;
  overlapPercent: number;
  structure: 'api' | 'rss' | 'json_ld' | 'structured_html' | 'html' | 'manual';
  official: boolean;
  freshness: number;
  familyRelevance: number;
  operationalRisk: number;
  notes: string;
}

export interface RankedSourceOpportunity extends SourceOpportunity { score: number; recommendedPriority: 'P1' | 'P2' | 'P3' }

export function rankSourceOpportunities(rows: SourceOpportunity[]): RankedSourceOpportunity[] {
  return rows.map((row) => {
    const structure = { api: 1, rss: .9, json_ld: .85, structured_html: .75, html: .5, manual: .2 }[row.structure];
    const netNew = Math.min(1, row.estimatedWeeklyNetNew / 20);
    const overlap = 1 - Math.max(0, Math.min(100, row.overlapPercent)) / 100;
    const score = Math.round(100 * (netNew * .3 + overlap * .2 + structure * .15 + clamp(row.freshness) * .1 + clamp(row.familyRelevance) * .15 + (row.official ? 1 : .5) * .1) / Math.max(.5, row.operationalRisk));
    return { ...row, score, recommendedPriority: score >= 60 ? 'P1' as const : score >= 35 ? 'P2' as const : 'P3' as const };
  }).sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}
function clamp(value: number): number { return Math.max(0, Math.min(1, value)); }
