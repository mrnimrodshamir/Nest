/** Cross-provider identity — a DIFFERENT problem from provider-local
 *  identity, and deliberately not solved the same way.
 *
 *  Provider-local identity (is this the same row I already have from THIS
 *  provider) stays exactly what it already was: `provider` +
 *  `providerEventId`, with `providerTransportId` as a fallback — see
 *  syncPlan.ts. That is strong because a provider's own identifiers are
 *  authoritative for its own records.
 *
 *  Cross-provider identity (is this DigiTel event and this Beit Ariela event
 *  actually the same real-world occurrence) has no authoritative key at all —
 *  neither source knows the other exists. The best available signal is
 *  similarity: normalized title, start time, venue, coordinates. Similarity
 *  is never certainty, which is why this module classifies rather than
 *  decides. Only EXACT is safe to act on automatically; PROBABLE and
 *  AMBIGUOUS exist to be shown to a human, never to silently merge two
 *  records — a wrong merge could move an RSVP onto the wrong event, which is
 *  a strictly worse outcome than a visible duplicate. */

export type DedupeClassification = 'EXACT' | 'PROBABLE' | 'AMBIGUOUS' | 'DISTINCT';

export interface DedupeComparable {
  provider: string;
  title: string;
  startsAt: string;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface DedupeResult {
  classification: DedupeClassification;
  titleSimilarity: number;
  timeDeltaMinutes: number | null;
  distanceMeters: number | null;
}

const EXACT_TITLE_SIMILARITY = 0.85;
const PROBABLE_TITLE_SIMILARITY = 0.55;
const WEAK_TITLE_SIMILARITY = 0.25;
/** Two events within 5 minutes of each other are the same sitting; ArcGIS and
 *  a CMS round trip to the minute differently often enough that 0 is too
 *  strict. */
const EXACT_TIME_TOLERANCE_MINUTES = 5;
const PROBABLE_TIME_TOLERANCE_MINUTES = 30;
const SAME_DAY_MINUTES = 24 * 60;
/** ~75m: generous enough to absorb two providers geocoding the same address
 *  slightly differently, tight enough that it never bridges two branches of
 *  the same library network. */
const EXACT_DISTANCE_METERS = 75;
const PROBABLE_DISTANCE_METERS = 300;

export function classifyCrossProviderMatch(a: DedupeComparable, b: DedupeComparable): DedupeResult {
  const titleSimilarity = normalizedTitleSimilarity(a.title, b.title);
  const timeDeltaMinutes = minutesBetween(a.startsAt, b.startsAt);
  const distanceMeters = metersBetween(a.latitude, a.longitude, b.latitude, b.longitude);
  const venueNameMatches = normalizedVenueMatch(a.locationName, b.locationName);

  const closeInTime = (tolerance: number) => timeDeltaMinutes !== null && timeDeltaMinutes <= tolerance;
  const closeInSpace = (tolerance: number) => distanceMeters !== null && distanceMeters <= tolerance;
  const sameVenue = (tolerance: number) => closeInSpace(tolerance) || venueNameMatches;

  if (
    titleSimilarity >= EXACT_TITLE_SIMILARITY
    && closeInTime(EXACT_TIME_TOLERANCE_MINUTES)
    && sameVenue(EXACT_DISTANCE_METERS)
  ) {
    return { classification: 'EXACT', titleSimilarity, timeDeltaMinutes, distanceMeters };
  }

  if (
    (titleSimilarity >= PROBABLE_TITLE_SIMILARITY && closeInTime(PROBABLE_TIME_TOLERANCE_MINUTES) && sameVenue(PROBABLE_DISTANCE_METERS))
    || (titleSimilarity >= EXACT_TITLE_SIMILARITY && closeInTime(PROBABLE_TIME_TOLERANCE_MINUTES))
  ) {
    return { classification: 'PROBABLE', titleSimilarity, timeDeltaMinutes, distanceMeters };
  }

  const someSignal = titleSimilarity >= WEAK_TITLE_SIMILARITY
    || sameVenue(PROBABLE_DISTANCE_METERS)
    || closeInTime(SAME_DAY_MINUTES);
  if (someSignal) {
    return { classification: 'AMBIGUOUS', titleSimilarity, timeDeltaMinutes, distanceMeters };
  }

  return { classification: 'DISTINCT', titleSimilarity, timeDeltaMinutes, distanceMeters };
}

/** NFKC + locale-aware lowercase + punctuation stripped — the same normal
 *  form used for occurrence fingerprints elsewhere in this codebase, so a
 *  title that fingerprints identically also similarity-matches at 1.0. */
export function normalizeTitleText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('he').replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/gu, ' ').trim();
}

/** Jaccard similarity over normalized token sets. Deliberately not edit
 *  distance or an embedding: token-set overlap is cheap, has no external
 *  dependency, and is easy to reason about when a human reviews a PROBABLE or
 *  AMBIGUOUS row in the dry-run report — "these titles share 3 of 5 words" is
 *  explainable in a way a similarity score alone is not. */
export function normalizedTitleSimilarity(a: string, b: string): number {
  const tokensA = new Set(normalizeTitleText(a).split(' ').filter(Boolean));
  const tokensB = new Set(normalizeTitleText(b).split(' ').filter(Boolean));
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersection = 0;
  for (const token of tokensA) if (tokensB.has(token)) intersection += 1;
  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

function normalizedVenueMatch(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return normalizeTitleText(a) === normalizeTitleText(b);
}

function minutesBetween(a: string, b: string): number | null {
  const timeA = Date.parse(a);
  const timeB = Date.parse(b);
  if (!Number.isFinite(timeA) || !Number.isFinite(timeB)) return null;
  return Math.abs(timeA - timeB) / 60_000;
}

/** Haversine distance in meters. No external dependency — this is the one
 *  piece of geometry the pipeline needs, and it is a stable, well-known
 *  formula rather than something worth pulling a library in for. */
function metersBetween(
  latA: number | null, lonA: number | null,
  latB: number | null, lonB: number | null,
): number | null {
  if (latA == null || lonA == null || latB == null || lonB == null) return null;
  const earthRadiusMeters = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(latB - latA);
  const dLon = toRad(lonB - lonA);
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const haversine = sinLat * sinLat + Math.cos(toRad(latA)) * Math.cos(toRad(latB)) * sinLon * sinLon;
  return 2 * earthRadiusMeters * Math.asin(Math.min(1, Math.sqrt(haversine)));
}
