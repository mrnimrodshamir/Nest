/** Tel Aviv Port dry-run — fetches the LIVE public site, normalizes, and
 *  reports what would happen. Writes nothing to Supabase.
 *
 *  Mirrors dry-run-beit-ariela.mjs's shape exactly: fetch → report, no
 *  database credentials in this file. Cross-provider dedupe against
 *  DigiTel/Beit Ariela is computed from a separate snapshot file (see
 *  --existing-snapshot), same pattern.
 *
 *      node scripts/dry-run-tel-aviv-port.mjs --output-dir <path> [--horizon-days 7] [--existing-snapshot <path>]
 */
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fetchTelAvivPortCandidates } from '../supabase/functions/_shared/telAvivPort/connector.ts';
import { mapTelAvivPortRecord, isFamilyTagged } from '../supabase/functions/_shared/telAvivPort/mapping.ts';
import { assessFamilyRelevance } from '../supabase/functions/_shared/providers/relevance.ts';
import { classifyCrossProviderMatch } from '../supabase/functions/_shared/providers/identity.ts';

const args = process.argv.slice(2);
if (args.includes('--apply') || args.includes('--publish')) {
  throw new Error('The Tel Aviv Port connector is dry-run only via this script; use the controlled-sync script for production writes.');
}
const outputDirArg = valueAfter('--output-dir');
if (!outputDirArg) throw new Error('Usage: node scripts/dry-run-tel-aviv-port.mjs --output-dir <path> [--horizon-days 7] [--existing-snapshot <path>]');
const outputDir = resolve(outputDirArg);
const horizonDays = boundedNumber(valueAfter('--horizon-days'), 7, 1, 30);
const existingSnapshotArg = valueAfter('--existing-snapshot');

const generatedAt = new Date();
console.log(`Fetching namal.co.il/events/ (horizon: ${horizonDays} days)…`);
const fetchResult = await fetchTelAvivPortCandidates({ now: generatedAt, horizonDays });

console.log(`  raw list items:       ${fetchResult.rawListItemCount}`);
console.log(`  invalid list items:   ${fetchResult.invalidListItems.length}`);
console.log(`  excluded (evergreen): ${fetchResult.excludedEvergreen.length}`);
console.log(`  within-horizon fetch: ${fetchResult.records.length}`);
console.log(`  detail fetch fails:   ${fetchResult.detailFetchFailures.length}`);
console.log(`  sourceComplete:       ${fetchResult.sourceComplete}`);
if (!fetchResult.sourceComplete) console.log(`  incomplete reason:     ${fetchResult.incompleteReason}`);

const notFamilyTagged = fetchResult.records.filter((r) => !isFamilyTagged(r.termIds));
const familyTagged = fetchResult.records.filter((r) => isFamilyTagged(r.termIds));

const mapped = familyTagged.map((raw) => ({ raw, ...mapTelAvivPortRecord(raw) }));
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
      { provider: 'tel_aviv_port', title: row.candidate.title, startsAt: row.candidate.startTime, locationName: row.candidate.locationName, latitude: row.candidate.latitude, longitude: row.candidate.longitude },
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

const report = {
  generatedAt: generatedAt.toISOString(),
  provider: 'tel_aviv_port',
  horizonDays,
  fetch: {
    sourceComplete: fetchResult.sourceComplete,
    incompleteReason: fetchResult.incompleteReason,
    rawListItemCount: fetchResult.rawListItemCount,
    invalidListItems: fetchResult.invalidListItems,
    excludedEvergreen: fetchResult.excludedEvergreen,
    detailFetchFailures: fetchResult.detailFetchFailures,
  },
  counts: {
    fetched: fetchResult.rawListItemCount,
    normalized: fetchResult.records.length,
    notFamilyTagged: notFamilyTagged.length,
    invalid: excludedByMapping.length,
    relevant: relevant.length,
    excludedByRelevance: excludedByRelevance.length,
    new: relevant.length, // first-ever run: nothing in the DB to match provider-locally yet
    existing: 0,
    exactDuplicate: dedupeCounts.EXACT,
    probableDuplicate: dedupeCounts.PROBABLE,
    ambiguousDuplicate: dedupeCounts.AMBIGUOUS,
    distinct: dedupeCounts.DISTINCT,
    withAgeData: withAge,
    withPriceData: withPrice,
    withRegistrationUrl: withRegistration,
    estimatedNetNew: dedupeCounts.DISTINCT + dedupeCounts.AMBIGUOUS, // AMBIGUOUS ships too — flagged, not merged, not dropped
  },
  excludedEvergreen: fetchResult.excludedEvergreen,
  notFamilyTagged: notFamilyTagged.map((r) => ({ title: r.title, termIds: r.termIds })),
  excludedByMapping: excludedByMapping.map((row) => ({ title: row.raw.title, reason: row.excludedReason })),
  excludedByRelevance: excludedByRelevance.map((row) => ({ title: row.candidate.title, reason: row.relevance.reason })),
  candidates: withDedupe.map((row) => ({
    title: row.candidate.title,
    startsAt: row.candidate.startTime,
    endsAt: row.candidate.endTime,
    occurrenceShape: row.candidate.startTime === row.candidate.endTime ? 'discrete' : (row.candidate.endTime ? 'multi_day' : 'discrete_no_end'),
    venue: row.candidate.locationName,
    ageRange: formatAgeRange(row.candidate.ageMinMonths, row.candidate.ageMaxMonths),
    price: row.candidate.priceNote,
    source: 'נמל תל אביב',
    sourceType: row.candidate.sourceType,
    registrationUrl: row.candidate.registrationUrl,
    airConditioned: row.candidate.airConditioned,
    indoorOutdoor: row.candidate.indoorOutdoor,
    relevanceReason: row.relevance.matched.join(', ') || row.relevance.reason,
    dedupeClassification: row.dedupe?.classification ?? 'DISTINCT',
    dedupeDetail: row.dedupe,
  })),
};

await mkdir(outputDir, { recursive: true });
await writeFile(resolve(outputDir, 'tel-aviv-port-dry-run.json'), JSON.stringify(report, null, 2), 'utf8');
console.log(`\nWrote ${resolve(outputDir, 'tel-aviv-port-dry-run.json')}`);
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
