/** Normalizes a parsed Tel Aviv Port record into the generic
 *  ProviderCandidate contract.
 *
 *  Family relevance is decided ENTIRELY by the site's own taxonomy —
 *  term-id-47 (ילדים / Kids) or term-id-69 (משפחה / Family), confirmed live
 *  against the listing page's own filter-button labels (see connector.ts's
 *  module doc). This mapper does not re-guess relevance from title
 *  keywords; that is `assessFamilyRelevance`'s job downstream in
 *  syncPlan.ts, run as a second, independent check — this function's own
 *  `isFamilyTagged` only decides whether the record is even worth handing
 *  to that second check.
 *
 *  sourceType is 'external_organizer', not 'municipal' — Namal Tel Aviv is
 *  a commercial port authority, not the municipality, and NestUp must never
 *  imply otherwise (see the provider-attribution requirement this
 *  connector was built against).
 *
 *  Coordinates come from NestUp's own already-curated `places` table
 *  ("Tel Aviv Port", queried 2026-08-19) — the same PLACES-tier discipline
 *  Beit Ariela's branches.ts uses, never geocoded on the fly. There is
 *  exactly one venue for this whole connector (unlike Beit Ariela's many
 *  branches), so there is no lookup table, just one constant.
 *
 *  air_conditioned and indoor/outdoor are set ONLY from explicit source
 *  text, never guessed from venue type in general — but "האנגר" (hangar)
 *  is treated as a specific, named indoor structure the same way Beit
 *  Ariela treats "a library branch" as necessarily indoors: it is not a
 *  category guess ("event venues are usually indoor"), it is what the word
 *  hangar means. A description that never mentions a hangar, a hall, or
 *  explicit air-conditioning gets null for both — most Port events do,
 *  correctly. */
import type { TelAvivPortRawRecord } from './connector.ts';
import type { ProviderCandidate } from '../providers/types.ts';
import { parseHebrewAgeRange } from '../providers/ageParsing.ts';
import { parsePriceText } from '../providers/priceParsing.ts';
import { parseAirConditioned } from '../providers/airConditioning.ts';
import { buildOccurrenceIdentityKey, fnv1a64 } from '../providers/fingerprint.ts';
import { classifyDigitelCategory } from '../digitel/eventMapping.ts';

export const TEL_AVIV_PORT_PROVIDER_KEY = 'tel_aviv_port';
export const TEL_AVIV_PORT_SOURCE_NAME = 'נמל תל אביב';
export const TEL_AVIV_PORT_PROVIDER_URL = 'https://www.namal.co.il';

/** From NestUp's curated `places` table (id e080594d-504e-4b25-89f3-ac842944ed03,
 *  queried 2026-08-19) — verified product data, not geocoded here. */
const VENUE = {
  latitude: 32.099096,
  longitude: 34.775714,
  formattedAddress: 'Kikar Plumer 14, Tel Aviv-Yafo, Israel',
} as const;

const DEFAULT_LOCATION_NAME = 'נמל תל אביב';
const INDOOR_STRUCTURE_PATTERN = /האנגר|אולם/;

export type TelAvivPortExclusionReason = 'missing_title' | 'not_family_tagged';

export interface MappedTelAvivPortResult {
  candidate: ProviderCandidate | null;
  excludedReason: TelAvivPortExclusionReason | null;
}

export function isFamilyTagged(termIds: readonly string[]): boolean {
  return termIds.includes('47') || termIds.includes('69');
}

export function mapTelAvivPortRecord(raw: TelAvivPortRawRecord): MappedTelAvivPortResult {
  if (!raw.title.trim()) return { candidate: null, excludedReason: 'missing_title' };
  if (!isFamilyTagged(raw.termIds)) return { candidate: null, excludedReason: 'not_family_tagged' };

  const age = parseHebrewAgeRange(raw.description);
  const price = parsePriceText(raw.priceText);
  const category = classifyDigitelCategory([raw.title, raw.description].filter(Boolean).join(' '));
  const locationName = raw.venueLine?.trim() || DEFAULT_LOCATION_NAME;
  const structureText = `${raw.venueLine ?? ''} ${raw.description ?? ''}`;
  const indoorOutdoor = INDOOR_STRUCTURE_PATTERN.test(structureText) ? 'indoor' : null;

  const identityKey = buildOccurrenceIdentityKey({
    title: raw.title,
    startTime: raw.startsAt,
    locationName,
    latitude: VENUE.latitude,
    longitude: VENUE.longitude,
  });
  const fingerprint = `tel-aviv-port-v1-${fnv1a64(identityKey)}`;

  const candidate: ProviderCandidate = {
    providerEventId: fingerprint,
    providerTransportId: raw.slug,
    sourceGroupId: null,
    title: raw.title,
    description: raw.description,
    category,
    sourceType: 'external_organizer',
    sourceUrl: raw.sourceUrl,
    startTime: raw.startsAt,
    endTime: raw.endsAt,
    locationName,
    formattedAddress: VENUE.formattedAddress,
    latitude: VENUE.latitude,
    longitude: VENUE.longitude,
    ageMinMonths: age.ageMinMonths,
    ageMaxMonths: age.ageMaxMonths,
    priceNote: price.priceNote,
    registrationRequired: raw.registrationUrl ? true : null,
    registrationUrl: raw.registrationUrl,
    airConditioned: parseAirConditioned(raw.description),
    indoorOutdoor,
    sourcePublishedAt: null,
    sourceUpdatedAt: null,
    providerMetadata: {
      slug: raw.slug,
      term_ids: raw.termIds.join(','),
    },
    occurrenceFingerprint: fingerprint,
  };

  return { candidate, excludedReason: null };
}
