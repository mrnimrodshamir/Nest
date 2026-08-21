import type { ProviderCandidate } from './types.ts';

export interface ExistingCrossCityEvent { title: string; startsAt: string; latitude: number; longitude: number; provider: string; cityId: string | null }
export type CrossCityClass = 'EXACT' | 'PROBABLE' | 'AMBIGUOUS' | 'DISTINCT';
export interface CrossCityMatch { classification: CrossCityClass; candidate: ProviderCandidate; existing: ExistingCrossCityEvent | null }

export function classifyCrossCityCandidates(candidates: ProviderCandidate[], existing: ExistingCrossCityEvent[]): CrossCityMatch[] {
  return candidates.map((candidate) => {
    let best: CrossCityMatch = { classification: 'DISTINCT', candidate, existing: null };
    for (const row of existing) {
      const timeMinutes = Math.abs(Date.parse(candidate.startTime) - Date.parse(row.startsAt)) / 60_000;
      const distance = distanceMeters(candidate.latitude, candidate.longitude, row.latitude, row.longitude);
      const titleScore = wordSimilarity(normalize(candidate.title), normalize(row.title));
      const exact = normalize(candidate.title) === normalize(row.title) && timeMinutes <= 15 && distance <= 300;
      const probable = titleScore >= 0.82 && timeMinutes <= 60 && distance <= 500;
      // Two-hour-apart municipal sessions are commonly distinct age-group slots.
      // Keep the review window strictly below two hours so a boundary-time session
      // is not treated as a possible syndicated duplicate.
      const ambiguous = titleScore >= 0.6 && timeMinutes < 120 && distance <= 1_000;
      const classification = exact ? 'EXACT' : probable ? 'PROBABLE' : ambiguous ? 'AMBIGUOUS' : 'DISTINCT';
      if (rank(classification) > rank(best.classification)) best = { classification, candidate, existing: row };
    }
    return best;
  });
}

function rank(value: CrossCityClass): number { return value === 'EXACT' ? 3 : value === 'PROBABLE' ? 2 : value === 'AMBIGUOUS' ? 1 : 0; }
function normalize(value: string): string { return value.normalize('NFKC').replace(/[״“”'".,:;!?()\[\]{}–—-]/g, ' ').replace(/\s+/g, ' ').trim().toLocaleLowerCase('he'); }
function wordSimilarity(a: string, b: string): number { const aa = new Set(a.split(' ')); const bb = new Set(b.split(' ')); const overlap = [...aa].filter((word) => bb.has(word)).length; return overlap / Math.max(aa.size, bb.size, 1); }
function distanceMeters(a: number, b: number, c: number, d: number): number { const radians = Math.PI / 180; const x = (d - b) * radians * Math.cos((a + c) * radians / 2); const y = (c - a) * radians; return Math.sqrt(x * x + y * y) * 6_371_000; }
