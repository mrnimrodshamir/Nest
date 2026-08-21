import type { DuplicateClass, QualityAssessment, QualityCandidate } from './types.ts';

const normalized = (value: string | null) => (value ?? '').normalize('NFKC').toLowerCase().replace(/[\u2010-\u2015]/g, '-').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const validDate = (value: string | null) => value !== null && Number.isFinite(Date.parse(value));
const validCoord = (lat: number | null, lon: number | null) => lat !== null && lon !== null && lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;

function distanceMeters(a: QualityCandidate, b: QualityCandidate): number | null {
  if (!validCoord(a.latitude, a.longitude) || !validCoord(b.latitude, b.longitude)) return null;
  const rad = Math.PI / 180; const p1 = a.latitude! * rad; const p2 = b.latitude! * rad;
  const dp = (b.latitude! - a.latitude!) * rad; const dl = (b.longitude! - a.longitude!) * rad;
  const h = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

export function classifyDuplicate(candidate: QualityCandidate, other: QualityCandidate): DuplicateClass {
  if (candidate.provider === other.provider && candidate.providerEventId && candidate.providerEventId === other.providerEventId) return 'EXACT';
  const titleMatch = normalized(candidate.title) === normalized(other.title);
  const sameTime = validDate(candidate.startsAt) && validDate(other.startsAt) && Math.abs(Date.parse(candidate.startsAt!) - Date.parse(other.startsAt!)) <= 15 * 60_000;
  const locationMatch = normalized(candidate.locationName) !== '' && normalized(candidate.locationName) === normalized(other.locationName);
  const proximity = distanceMeters(candidate, other);
  if (titleMatch && sameTime && (locationMatch || (proximity !== null && proximity <= 100))) return 'PROBABLE';
  if ((titleMatch && (sameTime || locationMatch)) || (sameTime && proximity !== null && proximity <= 250)) return 'AMBIGUOUS';
  return 'DISTINCT';
}

export function assessEventQuality(candidate: QualityCandidate, known: QualityCandidate[] = []): QualityAssessment {
  const reasons: string[] = [];
  let score = 100;
  if (!candidate.title.trim()) { score -= 60; reasons.push('missing_title'); }
  if (!validDate(candidate.startsAt)) { score -= 50; reasons.push('invalid_start_time'); }
  if (validDate(candidate.startsAt) && validDate(candidate.endsAt) && Date.parse(candidate.endsAt!) <= Date.parse(candidate.startsAt!)) { score -= 30; reasons.push('impossible_duration'); }
  if (!candidate.locationName && !validCoord(candidate.latitude, candidate.longitude)) { score -= 25; reasons.push('missing_location'); }
  if (/\btest\b|טסט/i.test(candidate.title)) { score -= 45; reasons.push('test_or_placeholder_content'); }
  if (candidate.familyRelevanceHint === false) { score -= 35; reasons.push('not_family_relevant'); }
  if (candidate.registrationUrl && !candidate.registrationUrl.startsWith('https://')) { score -= 15; reasons.push('invalid_registration_url'); }
  const duplicateClasses = known.map((other) => classifyDuplicate(candidate, other));
  const duplicateClass: DuplicateClass = duplicateClasses.includes('EXACT') ? 'EXACT' : duplicateClasses.includes('PROBABLE') ? 'PROBABLE' : duplicateClasses.includes('AMBIGUOUS') ? 'AMBIGUOUS' : 'DISTINCT';
  if (duplicateClass === 'EXACT') { score -= 50; reasons.push('exact_duplicate'); }
  else if (duplicateClass === 'PROBABLE') { score -= 25; reasons.push('probable_duplicate'); }
  else if (duplicateClass === 'AMBIGUOUS') { score -= 10; reasons.push('ambiguous_duplicate_requires_review'); }
  score = Math.max(0, score);
  const reject = score < 45;
  const review = !reject && (score < 75 || duplicateClass !== 'DISTINCT');
  return {
    eventId: candidate.id, qualityScore: score, publishRecommendation: reject ? 'REJECT' : review ? 'REVIEW' : 'PUBLISH', reasons,
    duplicateClass, categoryConfidence: candidate.category ? 85 : 30,
    ageConfidence: candidate.ageMinMonths !== null || candidate.ageMaxMonths !== null ? 90 : 25,
    locationConfidence: candidate.locationName && validCoord(candidate.latitude, candidate.longitude) ? 95 : candidate.locationName ? 65 : 20,
    priceConfidence: candidate.priceNote ? 75 : 25, sourceConfidence: candidate.providerEventId ? 90 : 55,
    manualReviewRequired: review || reject,
  };
}
