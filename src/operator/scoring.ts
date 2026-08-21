import type { HealthScore, HealthSignal } from './types.ts';
import type { ContentCandidate } from './types.ts';
import { auditContent } from './contentQuality.ts';

export const CONTENT_SCORE_WEIGHTS = {
  sourceCompleteness: 15, freshness: 15, validity: 10, uniqueness: 10,
  familyRelevance: 15, ageCoverage: 7.5, priceCoverage: 5,
  locationCoverage: 10, registrationCoverage: 5, categoryConfidence: 7.5,
} as const;

export const PRODUCT_SCORE_WEIGHTS = {
  tests: 20, typeScript: 15, expoDoctor: 10, iosExport: 15,
  criticalFlows: 15, edgeFunctions: 10, cronHealth: 5, security: 10,
} as const;

export function calculateHealthScore(signals: HealthSignal[]): HealthScore {
  const totalWeight = signals.reduce((sum, signal) => sum + signal.weight, 0);
  if (totalWeight <= 0) return { score: 0, signals: [], deductions: ['No measurable signals supplied'] };
  const scored = signals.map((signal) => {
    const value = clamp(signal.value);
    return { ...signal, value, deduction: round(signal.weight * (1 - value)) };
  });
  const earned = scored.reduce((sum, signal) => sum + signal.weight * signal.value, 0);
  return {
    score: Math.round((earned / totalWeight) * 100),
    signals: scored,
    deductions: scored.filter((signal) => signal.deduction > 0).map((signal) => `${signal.label}: -${signal.deduction}${signal.reason ? ` (${signal.reason})` : ''}`),
  };
}

export function contentHealth(values: Record<keyof typeof CONTENT_SCORE_WEIGHTS, number>, reasons: Partial<Record<keyof typeof CONTENT_SCORE_WEIGHTS, string>> = {}): HealthScore {
  return calculateHealthScore(Object.entries(CONTENT_SCORE_WEIGHTS).map(([id, weight]) => ({ id, label: humanize(id), value: values[id as keyof typeof CONTENT_SCORE_WEIGHTS], weight, reason: reasons[id as keyof typeof CONTENT_SCORE_WEIGHTS] })));
}

export function productHealth(values: Record<keyof typeof PRODUCT_SCORE_WEIGHTS, number>, reasons: Partial<Record<keyof typeof PRODUCT_SCORE_WEIGHTS, string>> = {}): HealthScore {
  return calculateHealthScore(Object.entries(PRODUCT_SCORE_WEIGHTS).map(([id, weight]) => ({ id, label: humanize(id), value: values[id as keyof typeof PRODUCT_SCORE_WEIGHTS], weight, reason: reasons[id as keyof typeof PRODUCT_SCORE_WEIGHTS] })));
}

export function scoreContentCandidates(events: ContentCandidate[]): HealthScore {
  const count = Math.max(1, events.length);
  const ratio = (predicate: (event: ContentCandidate) => boolean) => events.filter(predicate).length / count;
  const duplicates = auditContent(events).duplicateGroups.reduce((sum, group) => sum + group.length, 0);
  return contentHealth({
    sourceCompleteness: 1,
    freshness: ratio((event) => Number.isFinite(Date.parse(event.startsAt))),
    validity: ratio((event) => Number.isFinite(Date.parse(event.startsAt))),
    uniqueness: 1 - duplicates / count,
    familyRelevance: 1,
    ageCoverage: ratio((event) => event.ageMinMonths != null || event.ageMaxMonths != null),
    priceCoverage: ratio((event) => Boolean(event.priceNote)),
    locationCoverage: ratio((event) => event.latitude != null && event.longitude != null),
    registrationCoverage: ratio((event) => Boolean(event.registrationUrl || event.sourceUrl)),
    categoryConfidence: ratio((event) => Boolean(event.category && event.category !== 'other')),
  });
}

function clamp(value: number): number { return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0)); }
function round(value: number): number { return Math.round(value * 10) / 10; }
function humanize(value: string): string { return value.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase()); }
