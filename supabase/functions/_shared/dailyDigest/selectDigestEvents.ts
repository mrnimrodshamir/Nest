/** Pure selection logic for the Daily Digest: which of today's Tel Aviv
 *  occurrences (already lifecycle-filtered by `active_event_occurrences` —
 *  published, verified, visible, non-cancelled, non-archived, not yet
 *  ended) actually make it into the push, in what order.
 *
 *  Kept free of any Supabase/Deno import so it is directly unit-testable and
 *  so the exact same selection logic can be exercised from a dry run. */

export interface DigestCandidateOccurrence {
  occurrenceId: string;
  eventId: string;
  title: string;
  description?: string | null;
  category: string;
  /** ISO timestamp. */
  startsAt: string;
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  priceNote: string | null;
  provider: string;
  providerEventId?: string | null;
  sourceName: string | null;
  sourceUrl?: string | null;
  sourceType: 'municipal' | 'external_organizer' | null;
  /** Set only when this row is an explicitly-linked duplicate of another
   *  event — see events.canonical_event_id. Excluded outright. */
  canonicalEventId: string | null;
  latitude: number | null;
  longitude: number | null;
  locationName: string | null;
  formattedAddress?: string | null;
}

export interface SelectDigestEventsOptions {
  /** Jerusalem-local YYYY-MM-DD — "today" per jerusalemLocalDateString(). */
  localDate: string;
  targetLatitude: number;
  targetLongitude: number;
  /** Occurrences farther than this from the target are dropped outright —
   *  "Tel Aviv" is a place, not just any city-tagged row. */
  maxRadiusKm: number;
  minResults: number;
  maxResults: number;
}

export const TEL_AVIV_CENTER = { latitude: 32.0853, longitude: 34.7818 } as const;
export const DEFAULT_DIGEST_RADIUS_KM = 12;
export const DEFAULT_DIGEST_MIN_RESULTS = 2;
export const DEFAULT_DIGEST_MAX_RESULTS = 5;

function haversineKm(aLat: number, aLon: number, bLat: number, bLon: number): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLon = ((bLon - aLon) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Jerusalem-local calendar date of an ISO timestamp — an event at 00:30
 *  Jerusalem time belongs to that day, not the UTC day before it. */
function jerusalemDateOf(iso: string): string {
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' });
  return formatter.format(new Date(iso));
}

function isValidCandidate(candidate: DigestCandidateOccurrence): boolean {
  if (!candidate.occurrenceId.trim() || !candidate.eventId.trim() || !candidate.title.trim()) return false;
  if (!Number.isFinite(new Date(candidate.startsAt).getTime())) return false;
  if (candidate.latitude === null || candidate.longitude === null) return false;
  return Number.isFinite(candidate.latitude)
    && Number.isFinite(candidate.longitude)
    && candidate.latitude >= -90
    && candidate.latitude <= 90
    && candidate.longitude >= -180
    && candidate.longitude <= 180;
}

function normalizeIdentityText(value: string | null | undefined): string {
  return (value ?? '').normalize('NFKC').toLocaleLowerCase('he')
    .replace(/[\u2010-\u2015\-–—―'"׳״.,:;!?()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function descriptionContainment(left: string | null | undefined, right: string | null | undefined): number {
  const leftTokens = new Set(normalizeIdentityText(left).split(' ').filter((token) => token.length > 1));
  const rightTokens = new Set(normalizeIdentityText(right).split(' ').filter((token) => token.length > 1));
  const denominator = Math.min(leftTokens.size, rightTokens.size);
  if (denominator < 4) return 0;
  let overlap = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) overlap += 1;
  return overlap / denominator;
}

function mirrorQuality(candidate: DigestCandidateOccurrence): number {
  return (candidate.ageMinMonths !== null || candidate.ageMaxMonths !== null ? 3 : 0)
    + (candidate.priceNote ? 1 : 0)
    + (candidate.formattedAddress ? 1 : 0)
    + (candidate.sourceUrl ? 1 : 0)
    + Math.min(3, normalizeIdentityText(candidate.description).length / 120);
}

/** Removes only strongly-proven cross-provider mirrors. Similar sessions
 * from one provider, different age-group titles, dates, or venues remain
 * independent occurrences. */
export function dedupeMirroredDigestCandidates(candidates: readonly DigestCandidateOccurrence[]): DigestCandidateOccurrence[] {
  const sorted = [...candidates].sort((left, right) => mirrorQuality(right) - mirrorQuality(left));
  const kept: DigestCandidateOccurrence[] = [];
  for (const candidate of sorted) {
    const isMirror = kept.some((existing) => {
      if (existing.provider === candidate.provider) return false;
      if (normalizeIdentityText(existing.title) !== normalizeIdentityText(candidate.title)) return false;
      if (jerusalemDateOf(existing.startsAt) !== jerusalemDateOf(candidate.startsAt)) return false;
      if (Math.abs(Date.parse(existing.startsAt) - Date.parse(candidate.startsAt)) > 4 * 60 * 60 * 1000) return false;
      if (existing.latitude === null || existing.longitude === null || candidate.latitude === null || candidate.longitude === null) return false;
      if (haversineKm(existing.latitude, existing.longitude, candidate.latitude, candidate.longitude) > 0.5) return false;
      return descriptionContainment(existing.description, candidate.description) >= 0.6;
    });
    if (!isMirror) kept.push(candidate);
  }
  return kept;
}

function score(candidate: DigestCandidateOccurrence, distanceKm: number): number {
  let value = 0;
  if (candidate.ageMinMonths !== null || candidate.ageMaxMonths !== null) value += 2; // useful age data
  if (candidate.priceNote) value += 1; // price/free information present
  if (candidate.sourceType === 'municipal') value += 1; // provider trust proxy
  value += Math.max(0, 3 - distanceKm / 4); // proximity to Tel Aviv target area
  return value;
}

/** Deterministic ranking + selection. Never fabricates filler: if fewer than
 *  `minResults` valid candidates exist, returns everything that qualified
 *  (possibly zero) rather than padding up to a target count. */
export function selectDigestEvents(
  candidates: readonly DigestCandidateOccurrence[],
  options: SelectDigestEventsOptions,
): DigestCandidateOccurrence[] {
  const seenOccurrenceIds = new Set<string>();
  const withDistance = dedupeMirroredDigestCandidates(candidates)
    .filter((c) => c.canonicalEventId === null) // exclude duplicate/canonical-secondary records
    .filter(isValidCandidate)
    .filter((c) => {
      if (seenOccurrenceIds.has(c.occurrenceId)) return false;
      seenOccurrenceIds.add(c.occurrenceId);
      return true;
    })
    .filter((c) => jerusalemDateOf(c.startsAt) === options.localDate) // happening today, Jerusalem-local
    .map((c) => ({
      candidate: c,
      distanceKm: haversineKm(options.targetLatitude, options.targetLongitude, c.latitude as number, c.longitude as number),
    }))
    .filter(({ distanceKm }) => distanceKm <= options.maxRadiusKm);

  const ranked = withDistance
    .map(({ candidate, distanceKm }) => ({ candidate, distanceKm, score: score(candidate, distanceKm) }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const timeDiff = new Date(a.candidate.startsAt).getTime() - new Date(b.candidate.startsAt).getTime();
      if (timeDiff !== 0) return timeDiff; // sooner first among equally-scored events
      return a.candidate.title.localeCompare(b.candidate.title); // stable, deterministic tie-break
    });

  // Diversity pass: avoid 5 near-identical events by capping same-category
  // picks at 2 in a first pass, then filling any remaining slots from
  // whatever's left so a thin category mix never leaves slots empty.
  const categoryCounts = new Map<string, number>();
  const picked: typeof ranked = [];
  const deferred: typeof ranked = [];
  for (const entry of ranked) {
    if (picked.length >= options.maxResults) break;
    const count = categoryCounts.get(entry.candidate.category) ?? 0;
    if (count < 2) {
      picked.push(entry);
      categoryCounts.set(entry.candidate.category, count + 1);
    } else {
      deferred.push(entry);
    }
  }
  for (const entry of deferred) {
    if (picked.length >= options.maxResults) break;
    picked.push(entry);
  }

  return picked.map((entry) => entry.candidate);
}
