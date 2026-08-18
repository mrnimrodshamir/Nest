/** Normalizes a parsed Beit Ariela record into the generic ProviderCandidate
 *  contract, or explains why it cannot be one yet.
 *
 *  Two things are deliberately NEVER filled in here, even when it would be
 *  easy to guess:
 *
 *  - Coordinates. ariela.today publishes a venue name and a text address, no
 *    lat/lon. Resolved only via branches.ts's table of already-curated,
 *    verified NestUp place data — never geocoded on the fly, never
 *    estimated. A branch not in that table produces an EXCLUDED record with
 *    reason 'coordinates_unresolved', not a guessed pin.
 *  - air_conditioned. Never set true because the venue is a library. Only
 *    airConditioning.ts's explicit-text check may set it, and Beit Ariela's
 *    own copy never mentions it — so this connector's air_conditioned is,
 *    correctly, always null. That is a true finding about this source, not a
 *    gap to paper over.
 *
 *  Image rights are why image_url is left out of the candidate entirely: the
 *  source captions every photo with a named credit (confirmed on a live
 *  detail page — "תמונה: Canva/סיון חברי/יעל בר פסח"), which is a clear
 *  signal that these are NOT license-free stock images NestUp may re-host.
 *  The source URL is retained in providerMetadata for provenance and
 *  possible future rights clearance; it is never surfaced as the event's
 *  displayed image. */
import type { BeitArielaRawRecord } from './connector.ts';
import type { ProviderCandidate } from '../providers/types.ts';
import { resolveBranchCoordinates } from './branches.ts';
import { parseHebrewAgeRange } from '../providers/ageParsing.ts';
import { parsePriceText } from '../providers/priceParsing.ts';
import { parseAirConditioned } from '../providers/airConditioning.ts';
import { buildOccurrenceIdentityKey, fnv1a64 } from '../providers/fingerprint.ts';
import { classifyDigitelCategory } from '../digitel/eventMapping.ts';

export const BEIT_ARIELA_PROVIDER_KEY = 'beit_ariela_libraries';
export const BEIT_ARIELA_SOURCE_NAME = 'בית אריאלה וספריות תל אביב-יפו';
export const BEIT_ARIELA_PROVIDER_URL = 'https://ariela.today';

export type BeitArielaExclusionReason =
  | 'coordinates_unresolved'
  | 'missing_title'
  | 'missing_place';

export interface MappedBeitArielaResult {
  candidate: ProviderCandidate | null;
  excludedReason: BeitArielaExclusionReason | null;
}

export function mapBeitArielaRecord(raw: BeitArielaRawRecord): MappedBeitArielaResult {
  if (!raw.title.trim()) return { candidate: null, excludedReason: 'missing_title' };
  if (!raw.place.trim()) return { candidate: null, excludedReason: 'missing_place' };

  const branch = resolveBranchCoordinates(raw.place);
  if (!branch) return { candidate: null, excludedReason: 'coordinates_unresolved' };

  const age = parseHebrewAgeRange(raw.audienceText);
  const price = parsePriceText(raw.priceText);
  // Checked against title + subhead + description together, the same
  // multi-field haystack DigiTel's own classifier expects.
  const category = classifyDigitelCategory(
    [raw.title, raw.subhead, raw.description].filter(Boolean).join(' '),
  );

  const identityKey = buildOccurrenceIdentityKey({
    title: raw.title,
    startTime: raw.startsAt,
    locationName: raw.place,
    latitude: branch.latitude,
    longitude: branch.longitude,
  });
  const fingerprint = `beit-ariela-v1-${fnv1a64(identityKey)}`;

  const candidate: ProviderCandidate = {
    providerEventId: fingerprint,
    providerTransportId: raw.slug,
    sourceGroupId: null,
    title: raw.title,
    description: raw.description,
    category,
    sourceType: 'municipal',
    sourceUrl: raw.sourceUrl,
    startTime: raw.startsAt,
    endTime: raw.endsAt,
    locationName: raw.place,
    formattedAddress: raw.address ?? branch.formattedAddress,
    latitude: branch.latitude,
    longitude: branch.longitude,
    ageMinMonths: age.ageMinMonths,
    ageMaxMonths: age.ageMaxMonths,
    priceNote: price.priceNote,
    registrationRequired: raw.registrationUrl ? true : null,
    registrationUrl: raw.registrationUrl,
    // Beit Ariela's own copy never states this either way — see module doc.
    airConditioned: parseAirConditioned(raw.description),
    // Every branch is a library building; the event necessarily happens
    // indoors. Unlike air conditioning this is not a variable amenity claim,
    // it is what "at a library branch" means.
    indoorOutdoor: 'indoor',
    sourcePublishedAt: null,
    sourceUpdatedAt: null,
    providerMetadata: {
      subhead: raw.subhead ?? null,
      source_image_url: raw.imageUrl ?? null,
      source_image_credit: raw.imageCredit ?? null,
      slug: raw.slug,
    },
    occurrenceFingerprint: fingerprint,
  };

  return { candidate, excludedReason: null };
}
