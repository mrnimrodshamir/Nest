/** Normalizes a parsed Cinematheque occurrence into the generic
 *  ProviderCandidate contract.
 *
 *  providerEventId is derived from the WordPress `event_id` alone — NEVER
 *  from title text — which is what lets multiple showtimes of the same
 *  film (same event_id, different startTime) resolve to one Event with
 *  multiple Occurrences, while two different posts that happen to share a
 *  title (the site's own numerically-suffixed slugs for different program
 *  editions — see connector.ts's module doc) stay correctly separate. This
 *  is the identity resolution the brief required before this connector
 *  could go to production, backed by live evidence, not a title-similarity
 *  heuristic.
 *
 *  providerTransportId is the per-SHOWTIME ticket/order id — the
 *  occurrence-level fallback match key, distinct from providerEventId's
 *  film-level identity.
 *
 *  Price is always null here — this connector never fetches
 *  cintlv.pres.global, by design (see connector.ts's module doc); a null
 *  price_note for every Cinematheque candidate is an accepted, permanent
 *  property of this source, not a bug to fix later.
 *
 *  Coordinates are the one canonical Cinematheque venue — geocoded via
 *  OpenStreetMap Nominatim against the address independently confirmed by
 *  three unrelated business-directory listings (2026-08-19: "סינמטק
 *  תל-אביב ברחוב הארבעה, תל אביב" / "התו השמיני- סינמטק, הארבעה 5, תל
 *  אביב" / the Cinematheque's own contact page) — the same GEOCODE-tier
 *  discipline beitAriela/branches.ts uses for an address with no existing
 *  curated `places` row, cross-checked rather than accepted on one source
 *  alone. Hall ("אולם") is occurrence metadata when present, never a
 *  second coordinate or a separate venue — per the brief. It resolved null
 *  on every candidate checked live; see connector.ts's module doc for why
 *  that is an honest finding, not a parsing gap. */
import type { CinemathequeRawOccurrence } from './connector.ts';
import type { ProviderCandidate } from '../providers/types.ts';
import { parseHebrewAgeRange } from '../providers/ageParsing.ts';
import { buildOccurrenceIdentityKey, fnv1a64 } from '../providers/fingerprint.ts';
import { classifyDigitelCategory } from '../digitel/eventMapping.ts';

export const CINEMATHEQUE_PROVIDER_KEY = 'tel_aviv_cinematheque';
export const CINEMATHEQUE_SOURCE_NAME = 'סינמטק תל אביב';
export const CINEMATHEQUE_PROVIDER_URL = 'https://www.cinema.co.il';

/** Geocoded 2026-08-19 via OpenStreetMap Nominatim for "הארבעה 5, תל
 *  אביב", independently cross-confirmed against 3 unrelated live sources
 *  (see module doc). No existing `places` row for this venue yet. */
const VENUE = {
  latitude: 32.070663,
  longitude: 34.78335,
  formattedAddress: 'HaArba\'a Street 5, Tel Aviv-Yafo, Israel',
} as const;

const LOCATION_NAME = 'סינמטק תל אביב';

export type CinemathequeExclusionReason = 'missing_title' | 'missing_source_url';

export interface MappedCinemathequeResult {
  candidate: ProviderCandidate | null;
  excludedReason: CinemathequeExclusionReason | null;
}

export function mapCinemathequeOccurrence(raw: CinemathequeRawOccurrence): MappedCinemathequeResult {
  if (!raw.title.trim()) return { candidate: null, excludedReason: 'missing_title' };
  if (!raw.sourceUrl.trim()) return { candidate: null, excludedReason: 'missing_source_url' };

  const age = parseHebrewAgeRange(raw.description);
  const category = classifyDigitelCategory([raw.title, raw.description].filter(Boolean).join(' '));
  const endTime = raw.durationMinutes
    ? new Date(Date.parse(raw.startsAt) + raw.durationMinutes * 60_000).toISOString()
    : null;

  const eventIdentityKey = `cinematheque-event-v1|${raw.eventId}`;
  const providerEventId = `cinematheque-v1-${fnv1a64(eventIdentityKey)}`;

  const occurrenceIdentityKey = buildOccurrenceIdentityKey({
    title: raw.title,
    startTime: raw.startsAt,
    locationName: LOCATION_NAME,
    latitude: VENUE.latitude,
    longitude: VENUE.longitude,
  });
  const occurrenceFingerprint = `cinematheque-occ-v1-${fnv1a64(occurrenceIdentityKey)}`;

  const candidate: ProviderCandidate = {
    providerEventId,
    providerTransportId: raw.ticketId,
    sourceGroupId: raw.eventId,
    title: raw.title,
    description: raw.description,
    category,
    sourceType: 'external_organizer',
    sourceUrl: raw.sourceUrl,
    startTime: raw.startsAt,
    endTime,
    locationName: LOCATION_NAME,
    formattedAddress: VENUE.formattedAddress,
    latitude: VENUE.latitude,
    longitude: VENUE.longitude,
    ageMinMonths: age.ageMinMonths,
    ageMaxMonths: age.ageMaxMonths,
    // Never crawled — see module doc. Always null, by design.
    priceNote: null,
    registrationRequired: true,
    registrationUrl: `https://cintlv.pres.global/order/${raw.ticketId}/`,
    // The site's own copy never states this either way.
    airConditioned: null,
    // A cinema screening hall is, definitionally, indoors — the same
    // "what the venue type IS" reasoning beitAriela/mapping.ts uses for
    // library branches, not a guess about amenities.
    indoorOutdoor: 'indoor',
    sourcePublishedAt: null,
    sourceUpdatedAt: null,
    providerMetadata: {
      event_id: raw.eventId,
      ticket_id: raw.ticketId,
      director: raw.director,
      language: raw.language,
      country: raw.country,
      year: raw.year,
      duration_minutes: raw.durationMinutes,
      hall: raw.hall,
    },
    occurrenceFingerprint,
  };

  return { candidate, excludedReason: null };
}
