/** Tel Aviv Cinematheque dry-run — fetches the LIVE public schedule pages
 *  day-by-day, normalizes, and reports what would happen. Writes nothing
 *  to Supabase. Mirrors dry-run-tel-aviv-port.mjs's shape exactly.
 *
 *  Also reports EVENT-level grouping (distinct films) separately from
 *  OCCURRENCE-level counts (distinct showtimes), since this connector's
 *  whole point is that multiple showtimes collapse into one Event.
 *
 *      node scripts/dry-run-cinematheque.mjs --output-dir <path> [--horizon-days 7] [--existing-snapshot <path>]
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fetchCinemathequeCandidates } from '../supabase/functions/_shared/cinematheque/connector.ts';
import { mapCinemathequeOccurrence } from '../supabase/functions/_shared/cinematheque/mapping.ts';
import { assessFamilyRelevance } from '../supabase/functions/_shared/providers/relevance.ts';
import { classifyCrossProviderMatch } from '../supabase/functions/_shared/providers/identity.ts';

const args = process.argv.slice(2);
if (args.includes('--apply') || args.includes('--publish')) {
  throw new Error('The Cinematheque connector is dry-run only via this script; use the controlled-sync script for production writes.');
}
const outputDirArg = valueAfter('--output-dir');
if (!outputDirArg) throw new Error('Usage: node scripts/dry-run-cinematheque.mjs --output-dir <path> [--horizon-days 7] [--existing-snapshot <path>]');
const outputDir = resolve(outputDirArg);
const horizonDays = boundedNumber(valueAfter('--horizon-days'), 7, 1, 30);
const existingSnapshotArg = valueAfter('--existing-snapshot');

const generatedAt = new Date();
console.log(`Fetching cinema.co.il/shown/?date= for ${horizonDays} days…`);
const fetchResult = await fetchCinemathequeCandidates({ now: generatedAt, horizonDays });

console.log(`  days fetched:         ${fetchResult.daysFetched}/${horizonDays}`);
console.log(`  day failures:         ${fetchResult.dayFailures.length}`);
console.log(`  raw cards seen:       ${fetchResult.rawCardCount}`);
console.log(`  family occurrences:   ${fetchResult.occurrences.length}`);
console.log(`  sourceComplete:       ${fetchResult.sourceComplete}`);
if (!fetchResult.sourceComplete) console.log(`  incomplete reason:     ${fetchResult.incompleteReason}`);

const mapped = fetchResult.occurrences.map((raw) => ({ raw, ...mapCinemathequeOccurrence(raw) }));
const validCandidates = mapped.filter((row) => row.candidate);
const excludedByMapping = mapped.filter((row) => !row.candidate);

const relevanceResults = validCandidates.map((row) => ({
  ...row,
  relevance: assessFamilyRelevance({
    title: row.candidate.title, description: row.candidate.description,
    sourceType: row.candidate.category, locationName: row.candidate.locationName,
  }),
}));
const relevant = relevanceResults.filter((row) => row.relevance.relevant);
const excludedByRelevance = relevanceResults.filter((row) => !row.relevance.relevant);

const distinctEventIds = new Set(relevant.map((row) => row.candidate.sourceGroupId));

let existingEvents = [];
if (existingSnapshotArg) {
  existingEvents = JSON.parse(await readFile(resolve(existingSnapshotArg), 'utf8'));
  console.log(`Loaded ${existingEvents.length} existing events from snapshot for cross-provider comparison.`);
} else {
  console.log('No --existing-snapshot supplied; cross-provider dedupe classification will report DISTINCT for everything.');
}

const dedupeCounts = { EXACT: 0, PROBABLE: 0, AMBIGUOUS: 0, DISTINCT: 0 };
const withDedupe = relevant.map((row) => {
  let best = { classification: 'DISTINCT', titleSimilarity: 0, timeDeltaMinutes: null, distanceMeters: null };
  const rank = { EXACT: 3, PROBABLE: 2, AMBIGUOUS: 1, DISTINCT: 0 };
  for (const existing of existingEvents) {
    const result = classifyCrossProviderMatch(
      { provider: 'tel_aviv_cinematheque', title: row.candidate.title, startsAt: row.candidate.startTime, locationName: row.candidate.locationName, latitude: row.candidate.latitude, longitude: row.candidate.longitude },
      { provider: existing.provider, title: existing.title, startsAt: existing.starts_at, locationName: existing.location_name, latitude: existing.latitude, longitude: existing.longitude },
    );
    if (rank[result.classification] > rank[best.classification]) best = result;
  }
  dedupeCounts[best.classification] += 1;
  return { ...row, dedupe: best };
});

const withAge = relevant.filter((r) => r.candidate.ageMinMonths !== null || r.candidate.ageMaxMonths !== null).length;
const withHall = relevant.filter((r) => r.candidate.providerMetadata.hall !== null).length;

const report = {
  generatedAt: generatedAt.toISOString(),
  provider: 'tel_aviv_cinematheque',
  horizonDays,
  identityResult: 'CONFIRMED via live evidence 2026-08-19: repeated showtimes of the same film share one stable WordPress event_id across different day-schedule pages — grouped as one Event + multiple Occurrences, keyed by event_id, never by title.',
  fetch: {
    sourceComplete: fetchResult.sourceComplete,
    incompleteReason: fetchResult.incompleteReason,
    daysFetched: fetchResult.daysFetched,
    dayFailures: fetchResult.dayFailures,
    rawCardCount: fetchResult.rawCardCount,
  },
  counts: {
    fetched: fetchResult.occurrences.length, // raw family-tagged (movie-cat-10) occurrences across the horizon
    normalized: validCandidates.length,
    invalid: excludedByMapping.length,
    relevant: relevant.length,
    excludedByRelevance: excludedByRelevance.length,
    distinctEvents: distinctEventIds.size,
    occurrences: relevant.length,
    new: relevant.length, // first-ever run: nothing in the DB to match provider-locally yet
    existing: 0,
    exactDuplicate: dedupeCounts.EXACT,
    probableDuplicate: dedupeCounts.PROBABLE,
    ambiguousDuplicate: dedupeCounts.AMBIGUOUS,
    distinct: dedupeCounts.DISTINCT,
    withAgeData: withAge,
    withPriceData: 0, // always 0 — price is never fetched, by design
    withHallData: withHall,
    estimatedNetNew: dedupeCounts.DISTINCT + dedupeCounts.AMBIGUOUS,
  },
  excludedByMapping: excludedByMapping.map((row) => ({ title: row.raw.title, reason: row.excludedReason })),
  excludedByRelevance: excludedByRelevance.map((row) => ({ title: row.candidate.title, reason: row.relevance.reason })),
  candidates: withDedupe.map((row) => ({
    eventId: row.candidate.sourceGroupId,
    title: row.candidate.title,
    startsAt: row.candidate.startTime,
    endsAt: row.candidate.endTime,
    director: row.candidate.providerMetadata.director,
    language: row.candidate.providerMetadata.language,
    hall: row.candidate.providerMetadata.hall,
    ageRange: formatAgeRange(row.candidate.ageMinMonths, row.candidate.ageMaxMonths),
    price: row.candidate.priceNote,
    source: 'סינמטק תל אביב',
    sourceType: row.candidate.sourceType,
    registrationUrl: row.candidate.registrationUrl,
    relevanceReason: row.relevance.matched.join(', ') || row.relevance.reason,
    dedupeClassification: row.dedupe?.classification ?? 'DISTINCT',
    dedupeDetail: row.dedupe,
  })),
};

await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, 'cinematheque-dry-run.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(`\nWrote ${resolve(outputDir, 'cinematheque-dry-run.json')}`);
console.log(JSON.stringify(report.counts, null, 2));

function formatAgeRange(min, max) {
  if (min === null && max === null) return 'unknown';
  if (min !== null && max !== null) return `${Math.round(min / 12)}–${Math.round(max / 12)} years`;
  if (min !== null) return `${Math.round(min / 12)}+ years`;
  return `up to ${Math.round(max / 12)} years`;
}

function valueAfter(flag) {
  const index = args.indexOf(flag);
  return index === -1 ? null : args[index + 1];
}

function boundedNumber(raw, fallback, min, max) {
  const value = raw === null ? fallback : Number(raw);
  return Number.isFinite(value) ? Math.min(max, Math.max(min, value)) : fallback;
}
