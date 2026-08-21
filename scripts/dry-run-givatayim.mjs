import { fetchGivatayimCandidates } from '../supabase/functions/_shared/givatayimMunicipality/connector.ts';
import { dedupeGivatayimCandidates, mapGivatayimRecord } from '../supabase/functions/_shared/givatayimMunicipality/mapping.ts';

const result = await fetchGivatayimCandidates({ horizonDays: 7 });
const mapped = result.records.map((record) => mapGivatayimRecord(record));
const relevantBeforeDedupe = mapped.filter(Boolean);
const deduped = dedupeGivatayimCandidates(relevantBeforeDedupe);
const rows = deduped.candidates;
console.log(JSON.stringify({
  mode: 'dry_run', sourceComplete: result.sourceComplete, incompleteReason: result.incompleteReason,
  fetched: result.rawCount, normalized: result.records.length, relevant: rows.length,
  excluded: result.excluded.length + mapped.filter((row) => !row).length,
  invalid: result.invalid.length, exact: deduped.duplicateCount, probable: 0, ambiguous: 0, distinct: rows.length,
  ageData: rows.filter((row) => row.ageMinMonths !== null || row.ageMaxMonths !== null).length,
  priceData: rows.filter((row) => row.priceNote !== null).length,
  registrationUrls: rows.filter((row) => row.registrationUrl !== null).length,
  coordinates: rows.filter((row) => Number.isFinite(row.latitude) && Number.isFinite(row.longitude)).length,
  unresolvedVenues: result.excluded.filter((row) => row.reason.includes('boundary')).length,
  sample: rows.slice(0, 20).map((row) => ({ id: row.providerEventId, title: row.title, startsAt: row.startTime, venue: row.locationName, age: [row.ageMinMonths, row.ageMaxMonths] })),
}, null, 2));
if (!result.sourceComplete) process.exitCode = 2;
