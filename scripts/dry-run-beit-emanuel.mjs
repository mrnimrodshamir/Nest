import { fetchBeitEmanuelCandidates } from '../supabase/functions/_shared/beitEmanuel/connector.ts';
import { dedupeBeitEmanuelCandidates, mapBeitEmanuelRecord } from '../supabase/functions/_shared/beitEmanuel/mapping.ts';
import { assessFamilyRelevance } from '../supabase/functions/_shared/providers/relevance.ts';

const result = await fetchBeitEmanuelCandidates({ horizonDays: 7 });
const mapped = result.records.map((record) => ({ record, ...mapBeitEmanuelRecord(record) }));
const beforeDedupe = mapped.flatMap((row) => row.candidate ? [row.candidate] : []);
const deduped = dedupeBeitEmanuelCandidates(beforeDedupe);
const candidates = deduped.candidates;
const relevant = candidates.filter((candidate) => assessFamilyRelevance({ title: candidate.title, description: candidate.description, sourceType: candidate.category, locationName: candidate.locationName }).relevant);
const exclusions = Object.groupBy(mapped.filter((row) => !row.candidate), (row) => row.excludedReason ?? 'unknown');
const fingerprints = new Set(relevant.map((row) => row.occurrenceFingerprint));
const ids = new Set(relevant.map((row) => row.providerEventId));
const report = {
  mode: 'dry_run', sourceComplete: result.sourceComplete, incompleteReason: result.incompleteReason,
  fetched: result.rawCount, normalized: result.records.length, coordinateCoverage: candidates.length,
  relevant: relevant.length, excluded: result.excluded.length + mapped.length - candidates.length + candidates.length - relevant.length,
  invalid: result.invalid.length, exactDuplicates: deduped.duplicateCount + relevant.length - fingerprints.size,
  providerIdDuplicates: relevant.length - ids.size, probableDuplicates: 0, ambiguousDuplicates: 0, distinct: fingerprints.size,
  ageData: relevant.filter((row) => row.ageMinMonths !== null || row.ageMaxMonths !== null).length,
  priceData: relevant.filter((row) => row.priceNote !== null).length,
  registrationUrls: relevant.filter((row) => row.registrationUrl !== null).length,
  exclusions: { ...Object.fromEntries(Object.entries(exclusions).map(([key, rows]) => [key, rows.length])), not_a_discrete_occurrence: result.excluded.length },
  sample: relevant.slice(0, 20).map((row) => ({ id: row.providerEventId, title: row.title, startsAt: row.startTime, venue: row.locationName })),
};
console.log(JSON.stringify(report, null, 2));
if (!result.sourceComplete) process.exitCode = 2;
