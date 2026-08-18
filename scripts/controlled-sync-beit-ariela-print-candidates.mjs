/** One-shot helper for the controlled Beit Ariela production sync: fetches
 *  the live site, maps + filters exactly like the dry run, and prints the
 *  full ProviderCandidate JSON for the family-relevant survivors so they can
 *  be passed to apply_complete_provider_sync in a single reviewed call.
 *  Read-only against Supabase — no credentials, no writes, mirrors
 *  dry-run-beit-ariela.mjs's fetch/map/filter path exactly. */
import { fetchBeitArielaCandidates } from '../supabase/functions/_shared/beitAriela/connector.ts';
import { mapBeitArielaRecord, BEIT_ARIELA_PROVIDER_URL, BEIT_ARIELA_SOURCE_NAME } from '../supabase/functions/_shared/beitAriela/mapping.ts';
import { assessFamilyRelevance } from '../supabase/functions/_shared/providers/relevance.ts';

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
