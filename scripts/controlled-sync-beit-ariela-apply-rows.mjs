/** Full candidate rows (including occurrenceId) for the controlled Beit
 *  Ariela production sync via apply_complete_provider_sync — mirrors the
 *  Port/Cinematheque controlled-sync scripts. Read-only against Supabase;
 *  prints JSON only. */
import { fetchBeitArielaCandidates } from '../supabase/functions/_shared/beitAriela/connector.ts';
import { mapBeitArielaRecord, BEIT_ARIELA_PROVIDER_URL, BEIT_ARIELA_SOURCE_NAME } from '../supabase/functions/_shared/beitAriela/mapping.ts';
import { assessFamilyRelevance } from '../supabase/functions/_shared/providers/relevance.ts';
import { createOccurrenceId } from '../supabase/functions/_shared/digitel/eventMapping.ts';

const generatedAt = new Date();
const fetchResult = await fetchBeitArielaCandidates({ now: generatedAt, horizonDays: 7 });
if (!fetchResult.sourceComplete) throw new Error(`sourceComplete=false: ${fetchResult.incompleteReason}`);

const mapped = fetchResult.records.map((raw) => mapBeitArielaRecord(raw)).filter((row) => row.candidate);
const relevant = mapped.filter((row) => assessFamilyRelevance({
  title: row.candidate.title, description: row.candidate.description,
  sourceType: row.candidate.category, locationName: row.candidate.locationName,
}).relevant);

const rows = relevant.map((row) => {
  const c = row.candidate;
  return {
    eligibleForNestupPublication: true,
    providerEventId: c.providerEventId,
    providerTransportId: c.providerTransportId,
    occurrenceId: createOccurrenceId('beit_ariela_libraries', c.providerEventId, c.startTime),
    occurrenceFingerprint: c.occurrenceFingerprint,
    title: c.title,
    description: c.description,
    category: c.category,
    sourceType: c.sourceType,
    sourceUrl: c.sourceUrl,
    sourceName: BEIT_ARIELA_SOURCE_NAME,
    providerUrl: BEIT_ARIELA_PROVIDER_URL,
    startsAt: c.startTime,
    endsAt: c.endTime,
    locationName: c.locationName,
    formattedAddress: c.formattedAddress,
    latitude: c.latitude,
    longitude: c.longitude,
    ageMinMonths: c.ageMinMonths,
    ageMaxMonths: c.ageMaxMonths,
    priceNote: c.priceNote,
    registrationRequired: c.registrationRequired,
    registrationUrl: c.registrationUrl,
    sourcePublishedAt: c.sourcePublishedAt,
    sourceUpdatedAt: c.sourceUpdatedAt,
    providerMetadata: c.providerMetadata,
  };
});

console.log(JSON.stringify(rows, null, 2));
console.error(`\n${rows.length} eligible candidates`);
