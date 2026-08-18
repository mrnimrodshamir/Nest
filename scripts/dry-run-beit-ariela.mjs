/** Beit Ariela dry-run — fetches the LIVE public site, normalizes, and
 *  reports what would happen. Writes nothing to Supabase; there is no
 *  --apply flag because this connector has no production write path yet.
 *
 *  Deliberately mirrors scripts/import-digitel.mjs's shape (fetch → report,
 *  no database credentials in this file at all) for provider-local numbers.
 *  Cross-provider dedupe classification against existing DigiTel events is
 *  computed in a SEPARATE pass from a snapshot file, so this script never
 *  needs a Supabase credential of its own — see docs/releases/
 *  beit-ariela-dry-run.md for how that snapshot was produced.
 *
 *      node scripts/dry-run-beit-ariela.mjs --output-dir <path> [--horizon-days 7] [--existing-snapshot <path>]
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fetchBeitArielaCandidates } from '../supabase/functions/_shared/beitAriela/connector.ts';
import { mapBeitArielaRecord } from '../supabase/functions/_shared/beitAriela/mapping.ts';
import { assessFamilyRelevance } from '../supabase/functions/_shared/providers/relevance.ts';
import { classifyCrossProviderMatch } from '../supabase/functions/_shared/providers/identity.ts';

const args = process.argv.slice(2);
if (args.includes('--apply') || args.includes('--publish')) {
  throw new Error('The Beit Ariela connector is dry-run only in this phase; --apply/--publish are not supported.');
}
const outputDirArg = valueAfter('--output-dir');
if (!outputDirArg) throw new Error('Usage: node scripts/dry-run-beit-ariela.mjs --output-dir <path> [--horizon-days 7] [--existing-snapshot <path>]');
const outputDir = resolve(outputDirArg);
const horizonDays = boundedNumber(valueAfter('--horizon-days'), 7, 1, 30);
const existingSnapshotArg = valueAfter('--existing-snapshot');

const generatedAt = new Date();
console.log(`Fetching ariela.today (horizon: ${horizonDays} days)…`);
const fetchResult = await fetchBeitArielaCandidates({ now: generatedAt, horizonDays });

console.log(`  pages fetched:        ${fetchResult.pagesFetched}`);
console.log(`  raw list items:       ${fetchResult.rawListItemCount}`);
console.log(`  within horizon:       ${fetchResult.records.length + fetchResult.detailFetchFailures.length}`);
console.log(`  detail fetch fails:   ${fetchResult.detailFetchFailures.length}`);
console.log(`  sourceComplete:       ${fetchResult.sourceComplete}`);
if (!fetchResult.sourceComplete) console.log(`  incomplete reason:     ${fetchResult.incompleteReason}`);

const mapped = fetchResult.records.map((raw) => ({ raw, ...mapBeitArielaRecord(raw) }));
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
      { provider: 'beit_ariela_libraries', title: row.candidate.title, startsAt: row.candidate.startTime, locationName: row.candidate.locationName, latitude: row.candidate.latitude, longitude: row.candidate.longitude },
      { provider: existing.provider, title: existing.title, startsAt: existing.starts_at, locationName: existing.location_name, latitude: existing.latitude, longitude: existing.longitude },
    );
    if (rank[result.classification] > rank[best.classification]) best = result;
  }
  dedupeCounts[best.classification] += 1;
  return { ...row, dedupe: best };
});

const withAge = relevant.filter((r) => r.candidate.ageMinMonths !== null || r.candidate.ageMaxMonths !== null).length;
const withPrice = relevant.filter((r) => r.candidate.priceNote !== null).length;
const withRegistration = relevant.filter((r) => r.candidate.registrationUrl !== null).length;
const withCoordinates = relevant.length; // mapping already excludes anything without resolvable coordinates

const report = {
  generatedAt: generatedAt.toISOString(),
  provider: 'beit_ariela_libraries',
  horizonDays,
  fetch: {
    pagesFetched: fetchResult.pagesFetched,
    sourceComplete: fetchResult.sourceComplete,
    incompleteReason: fetchResult.incompleteReason,
    rawListItemCount: fetchResult.rawListItemCount,
    invalidListItems: fetchResult.invalidListItems,
    detailFetchFailures: fetchResult.detailFetchFailures,
  },
  counts: {
    fetched: fetchResult.rawListItemCount,
    normalized: fetchResult.records.length,
    invalid: excludedByMapping.length + fetchResult.invalidListItems.length,
    relevant: relevant.length,
    excludedByRelevance: excludedByRelevance.length,
    new: relevant.length, // Beit Ariela's first-ever run: nothing in the DB to match provider-locally yet
    existing: 0,
    exactDuplicate: dedupeCounts.EXACT,
    probableDuplicate: dedupeCounts.PROBABLE,
    ambiguousDuplicate: dedupeCounts.AMBIGUOUS,
    distinct: dedupeCounts.DISTINCT,
    withAgeData: withAge,
    withPriceData: withPrice,
    withRegistrationUrl: withRegistration,
    withCoordinates,
  },
  excludedByMapping: excludedByMapping.map((row) => ({ title: row.raw.title, reason: row.excludedReason })),
  excludedByRelevance: excludedByRelevance.map((row) => ({ title: row.candidate.title, reason: row.relevance.reason })),
  sample: withDedupe.slice(0, 10).map((row) => ({
    title: row.candidate.title,
    startsAt: row.candidate.startTime,
    venue: row.candidate.locationName,
    ageRange: formatAgeRange(row.candidate.ageMinMonths, row.candidate.ageMaxMonths),
    price: row.candidate.priceNote,
    source: 'בית אריאלה וספריות תל אביב-יפו',
    registrationUrl: row.candidate.registrationUrl,
    locationQuality: row.candidate.formattedAddress ? 'resolved via curated place table' : 'venue only, no street address',
    relevanceReason: row.relevance.matched.join(', ') || row.relevance.reason,
    dedupeClassification: row.dedupe?.classification ?? 'DISTINCT',
  })),
};

await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, 'beit-ariela-dry-run.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(`\nWrote ${resolve(outputDir, 'beit-ariela-dry-run.json')}`);
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
