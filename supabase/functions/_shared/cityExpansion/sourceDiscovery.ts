import type { SourceCandidate } from './types.ts';

const clamp = (value: number) => Math.max(0, Math.min(100, Math.round(value)));

export function canonicalSourceDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^www\./, '').replace(/\.$/, '');
}

export function scoreSource(candidate: SourceCandidate): number {
  const positive = candidate.familyRelevance * 0.24 + candidate.structuredDataAvailability * 0.16
    + candidate.sourceReliability * 0.16 + candidate.coverageEstimate * 0.12
    + candidate.freshness * 0.1 + candidate.expectedEventYield * 0.1
    + candidate.locationQuality * 0.05 + candidate.ageDataQuality * 0.04 + candidate.priceDataQuality * 0.03;
  const risk = candidate.legalOperationalRisk * 0.12 + candidate.connectorComplexity * 0.06;
  return clamp(positive - risk);
}

export function rankSourceCandidates(candidates: SourceCandidate[]): SourceCandidate[] {
  const seen = new Set<string>();
  return candidates.filter((candidate) => {
    const key = `${canonicalSourceDomain(candidate.domain)}|${candidate.sourceType.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return candidate.confidenceScore >= 40;
  }).map((candidate) => ({ ...candidate, overallScore: scoreSource(candidate) }))
    .sort((a, b) => (b.overallScore ?? 0) - (a.overallScore ?? 0) || a.sourceId.localeCompare(b.sourceId));
}
