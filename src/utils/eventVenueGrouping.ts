import type { EventDetails } from '@/types/event';

/** Groups Event occurrences that share a real-world venue so the map renders
 *  ONE marker per venue instead of exact-coordinate markers stacking on top
 *  of each other and becoming untappable.
 *
 *  This is deliberately distinct from geographic clustering (different
 *  venues that visually collide at the current zoom level, as
 *  src/utils/placeClustering.ts already does for Places): venue grouping is
 *  zoom-independent — the same real venue stays one marker at any zoom, and
 *  different venues must never merge just because they are close together.
 *  See resolveVenueKey's doc comment for the identity strategy. */

export type EventVenueMapItem =
  | { kind: 'single'; event: EventDetails }
  | { kind: 'venue'; key: string; latitude: number; longitude: number; venueName: string | null; events: EventDetails[] };

/** Buckets a coordinate onto a fixed-size grid so two points within
 *  `precisionDegrees` of each other land in the same cell, rather than
 *  requiring them to be equal to N decimal places (which "near-identical"
 *  independently-geocoded points for the same building rarely are). */
function coordinateGridKey(latitude: number, longitude: number, precisionDegrees: number): string {
  return `${Math.round(latitude / precisionDegrees)},${Math.round(longitude / precisionDegrees)}`;
}

// ~11m grid: paired with matching address text (tier 2), loose enough that
// two independent geocodes of the same building's entrance/rooftop/lobby
// still agree, still far too tight to reach a different building.
const ADDRESS_TIER_GRID_DEGREES = 0.0001;
// ~1.1m grid: the coordinate-only fallback (tier 3) with no address text to
// corroborate it, so it stays as close to "the exact same point" as
// floating-point geocoding noise allows.
const COORDINATE_ONLY_GRID_DEGREES = 0.00001;

/** Same normalization approach as
 *  supabase/functions/_shared/dailyDigest/selectDigestEvents.ts's
 *  normalizeIdentityText: casefolds, strips punctuation/dashes/quotes that
 *  differ across providers for the same address, and collapses whitespace —
 *  so "Dizengoff St. 99" and "דיזנגוף 99," normalize to a comparable form
 *  without a full address-parsing library. */
function normalizeVenueText(value: string | null | undefined): string {
  return (value ?? '').normalize('NFKC').toLocaleLowerCase('he')
    .replace(/[‐-―\-–—―'"׳״.,:;!?()[\]{}]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

/** Venue identity, most to least conservative:
 *
 *  1. Canonical `place_id` — an explicit link to the same `places` row is
 *     unambiguous. (No production Event currently carries one — see the
 *     production data audit — but the check costs nothing and starts paying
 *     off the moment place-linking ships.)
 *  2. Normalized venue/address text + near-identical coordinates (~11m
 *     grid). Requires BOTH signals to agree, so two different venues that
 *     happen to round to the same address text in different areas, or two
 *     venues that are merely close together with different addresses,
 *     never merge.
 *  3. Coordinates only (~1.1m grid), for the rare Event with no
 *     location_name and no formatted_address. This is the least specific
 *     signal, so it gets the tightest possible tolerance rather than a
 *     looser one — the goal is "the exact same point", not "nearby".
 *
 *  Never offsets or jitters coordinates, and never merges on coordinates
 *  alone at a looser tolerance than tier 3 — that is how neighbouring venues
 *  would incorrectly collapse into one marker. */
export function resolveVenueKey(event: EventDetails): string {
  const { placeId, name, formattedAddress, latitude, longitude } = event.location;
  if (placeId) return `place:${placeId}`;
  const addressText = normalizeVenueText(name) || normalizeVenueText(formattedAddress);
  if (addressText) return `addr:${addressText}|${coordinateGridKey(latitude, longitude, ADDRESS_TIER_GRID_DEGREES)}`;
  return `coord:${coordinateGridKey(latitude, longitude, COORDINATE_ONLY_GRID_DEGREES)}`;
}

function venueDisplayName(events: readonly EventDetails[]): string | null {
  for (const event of events) {
    if (event.location.name?.trim()) return event.location.name.trim();
  }
  for (const event of events) {
    if (event.location.formattedAddress?.trim()) return event.location.formattedAddress.trim();
  }
  return null;
}

/** Groups an already-filtered/visible set of Events. Callers are expected to
 *  pass exactly the Events currently matching the active filters — the
 *  per-marker count is a direct function of what is passed in, so "12 events
 *  at this venue" narrowing to "3" under a filter falls straight out of
 *  calling this again with the filtered array; there is no separate count
 *  to keep in sync. */
export function groupEventsByVenue(events: readonly EventDetails[]): EventVenueMapItem[] {
  const buckets = new Map<string, EventDetails[]>();
  for (const event of events) {
    const key = resolveVenueKey(event);
    const bucket = buckets.get(key);
    if (bucket) bucket.push(event); else buckets.set(key, [event]);
  }
  const items: EventVenueMapItem[] = [];
  for (const [key, members] of buckets) {
    if (members.length === 1) {
      items.push({ kind: 'single', event: members[0] });
      continue;
    }
    const sorted = [...members].sort((left, right) =>
      Date.parse(left.occurrence.startsAt) - Date.parse(right.occurrence.startsAt)
      || left.occurrence.id.localeCompare(right.occurrence.id));
    items.push({
      kind: 'venue',
      key,
      latitude: members.reduce((sum, event) => sum + event.location.latitude, 0) / members.length,
      longitude: members.reduce((sum, event) => sum + event.location.longitude, 0) / members.length,
      venueName: venueDisplayName(sorted),
      events: sorted,
    });
  }
  return items;
}
