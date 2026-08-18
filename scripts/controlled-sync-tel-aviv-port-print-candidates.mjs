/** One-shot helper for the controlled Tel Aviv Port production sync:
 *  fetches the live site, maps + filters exactly like the dry run, and
 *  prints the full candidate JSON (in the exact shape
 *  apply_complete_provider_sync expects, including occurrenceId) for the
 *  family-relevant survivors so they can be passed to that RPC in a single
 *  reviewed call. Read-only against Supabase — no credentials, no writes,
 *  mirrors controlled-sync-beit-ariela-print-candidates.mjs. */
import { fetchTelAvivPortCandidates } from '../supabase/functions/_shared/telAvivPort/connector.ts';
import { mapTelAvivPortRecord, isFamilyTagged, TEL_AVIV_PORT_PROVIDER_URL, TEL_AVIV_PORT_SOURCE_NAME } from '../supabase/functions/_shared/telAvivPort/mapping.ts';
import { assessFamilyRelevance } from '../supabase/functions/_shared/providers/relevance.ts';
import { createOccurrenceId } from '../supabase/functions/_shared/digitel/eventMapping.ts';

const generatedAt = new Date();
const fetchResult = await fetchTelAvivPortCandidates({ now: generatedAt, horizonDays: 7 });
if (!fetchResult.sourceComplete) throw new Error(`sourceComplete=false: ${fetchResult.incompleteReason}`);

const familyTagged = fetchResult.records.filter((r) => isFamilyTagged(r.termIds));
const mapped = familyTagged.map((raw) => mapTelAvivPortRecord(raw)).filter((row) => row.candidate);
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
    occurrenceId: createOccurrenceId('tel_aviv_port', c.providerEventId, c.startTime),
    occurrenceFingerprint: c.occurrenceFingerprint,
    title: c.title,
    description: c.description,
    category: c.category,
    sourceType: c.sourceType,
    sourceUrl: c.sourceUrl,
    sourceName: TEL_AVIV_PORT_SOURCE_NAME,
    providerUrl: TEL_AVIV_PORT_PROVIDER_URL,
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
