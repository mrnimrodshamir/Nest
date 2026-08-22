import test from 'node:test';
import assert from 'node:assert/strict';
import { groupEventsByVenue, resolveVenueKey } from '@/utils/eventVenueGrouping';
import { MOCK_EVENTS } from '@/mocks/mockEvents';
import type { EventDetails } from '@/types/event';

function eventAt(id: string, overrides: Partial<{ placeId: string | null; name: string | null; formattedAddress: string | null; latitude: number; longitude: number; startsAt: string }> = {}): EventDetails {
  const base = MOCK_EVENTS[0];
  return {
    ...base,
    id: `mock-${id}`,
    occurrence: { ...base.occurrence, id, eventId: `mock-${id}`, startsAt: overrides.startsAt ?? base.occurrence.startsAt },
    location: {
      placeId: overrides.placeId ?? base.location.placeId,
      name: overrides.name === undefined ? base.location.name : overrides.name,
      formattedAddress: overrides.formattedAddress === undefined ? base.location.formattedAddress : overrides.formattedAddress,
      latitude: overrides.latitude ?? base.location.latitude,
      longitude: overrides.longitude ?? base.location.longitude,
    },
  };
}

// --- Venue identity ----------------------------------------------------

test('a single Event passes through unchanged', () => {
  const [item] = groupEventsByVenue([eventAt('e1')]);
  assert.equal(item.kind, 'single');
});

test('two Events sharing a canonical place_id group by that id regardless of coordinates', () => {
  const events = [
    eventAt('e1', { placeId: 'place-123', latitude: 32.05, longitude: 34.75 }),
    eventAt('e2', { placeId: 'place-123', latitude: 32.09, longitude: 34.79 }), // far apart, same place_id
  ];
  const [item] = groupEventsByVenue(events);
  assert.equal(item.kind, 'venue');
  assert.ok(item.kind === 'venue' && item.key === 'place:place-123');
  assert.equal(item.kind === 'venue' ? item.events.length : 0, 2);
});

test('two Events with the same normalized address and near-identical coordinates group together', () => {
  const events = [
    eventAt('e1', { name: 'Dizengoff Center', latitude: 32.07701, longitude: 34.77401 }),
    eventAt('e2', { name: 'dizengoff center', latitude: 32.07702, longitude: 34.77402 }), // case-only diff, ~1m apart
  ];
  const [item] = groupEventsByVenue(events);
  assert.equal(item.kind, 'venue');
});

test('conservative coordinate-only fallback groups Events with no address text at identical coordinates', () => {
  const events = [
    eventAt('e1', { name: null, formattedAddress: null, latitude: 32.05, longitude: 34.75 }),
    eventAt('e2', { name: null, formattedAddress: null, latitude: 32.05, longitude: 34.75 }),
  ];
  const [item] = groupEventsByVenue(events);
  assert.equal(item.kind, 'venue');
  assert.ok(item.kind === 'venue' && item.key.startsWith('coord:'));
});

test('neighboring venues with different addresses never merge, even a few meters apart', () => {
  const events = [
    eventAt('e1', { name: 'Building A', latitude: 32.0500, longitude: 34.7500 }),
    eventAt('e2', { name: 'Building B', latitude: 32.0501, longitude: 34.7501 }), // ~15m away, different address
  ];
  const result = groupEventsByVenue(events);
  assert.equal(result.length, 2);
  assert.ok(result.every((item) => item.kind === 'single'));
});

test('two Events with no address, at coordinates a city block apart, never merge', () => {
  const events = [
    eventAt('e1', { name: null, formattedAddress: null, latitude: 32.0500, longitude: 34.7500 }),
    eventAt('e2', { name: null, formattedAddress: null, latitude: 32.0520, longitude: 34.7520 }), // ~250m away
  ];
  const result = groupEventsByVenue(events);
  assert.equal(result.length, 2);
});

test('coordinates are never offset or jittered by grouping', () => {
  const events = [eventAt('e1', { placeId: 'place-x' }), eventAt('e2', { placeId: 'place-x' })];
  const [item] = groupEventsByVenue(events);
  assert.ok(item.kind === 'venue');
  if (item.kind === 'venue') {
    assert.ok(Number.isFinite(item.latitude) && Number.isFinite(item.longitude));
    // Centroid of two identical mock coordinates equals the original coordinate exactly.
    assert.equal(item.latitude, events[0].location.latitude);
    assert.equal(item.longitude, events[0].location.longitude);
  }
});

// --- Marker count --------------------------------------------------------

test('marker count matches the number of Events passed in', () => {
  const events = Array.from({ length: 12 }, (_, index) => eventAt(`e${index}`, { placeId: 'busy-venue' }));
  const [item] = groupEventsByVenue(events);
  assert.ok(item.kind === 'venue' && item.events.length === 12);
});

test('filtering the input before grouping narrows the marker count — no separate count to desync', () => {
  const events = Array.from({ length: 12 }, (_, index) => eventAt(`e${index}`, { placeId: 'busy-venue', category: 'workshop' } as never));
  const filtered = events.slice(0, 3); // simulates a category/date filter already applied upstream
  const [item] = groupEventsByVenue(filtered);
  assert.ok(item.kind === 'venue' && item.events.length === 3);
});

// --- Sheet ordering --------------------------------------------------------

test('Events within a venue group are sorted soonest-first', () => {
  const events = [
    eventAt('e1', { placeId: 'p', startsAt: '2026-09-10T10:00:00.000Z' }),
    eventAt('e2', { placeId: 'p', startsAt: '2026-08-25T10:00:00.000Z' }),
    eventAt('e3', { placeId: 'p', startsAt: '2026-09-01T10:00:00.000Z' }),
  ];
  const [item] = groupEventsByVenue(events);
  assert.ok(item.kind === 'venue');
  if (item.kind === 'venue') {
    assert.deepEqual(item.events.map((event) => event.occurrence.id), ['e2', 'e3', 'e1']);
  }
});

// --- Venue name resolution --------------------------------------------------------

test('venue display name prefers location.name, falling back to formattedAddress', () => {
  const named = groupEventsByVenue([
    eventAt('e1', { placeId: 'p', name: null, formattedAddress: '123 Main St' }),
    eventAt('e2', { placeId: 'p', name: 'The Library', formattedAddress: null }),
  ])[0];
  assert.ok(named.kind === 'venue' && named.venueName === 'The Library');
});

test('venue display name is null when no Event has a name or address', () => {
  const unnamed = groupEventsByVenue([
    eventAt('e1', { placeId: 'p', name: null, formattedAddress: null }),
    eventAt('e2', { placeId: 'p', name: null, formattedAddress: null }),
  ])[0];
  assert.ok(unnamed.kind === 'venue' && unnamed.venueName === null);
});

// --- Regression: municipal metadata is untouched by grouping --------------

test('grouping does not mutate an Event\'s source metadata (municipal badge regression)', () => {
  const municipal = eventAt('e1', { placeId: 'p' });
  const other = eventAt('e2', { placeId: 'p' });
  const [item] = groupEventsByVenue([municipal, other]);
  assert.ok(item.kind === 'venue');
  if (item.kind === 'venue') {
    const found = item.events.find((event) => event.occurrence.id === 'e1');
    assert.deepEqual(found?.source, municipal.source);
  }
});

// --- resolveVenueKey directly ----------------------------------------------

test('resolveVenueKey prefers place_id over address and coordinates', () => {
  const event = eventAt('e1', { placeId: 'canonical-place', name: 'Some Venue', latitude: 32.05, longitude: 34.75 });
  assert.equal(resolveVenueKey(event), 'place:canonical-place');
});

test('resolveVenueKey falls back to a tight coordinate grid when no place_id or address exists', () => {
  const event = eventAt('e1', { placeId: null, name: null, formattedAddress: null, latitude: 32.05, longitude: 34.75 });
  assert.equal(resolveVenueKey(event), 'coord:3205000,3475000');
});

test('resolveVenueKey coordinate-only fallback still groups points within the same tight grid cell', () => {
  const a = eventAt('e1', { placeId: null, name: null, formattedAddress: null, latitude: 32.050001, longitude: 34.750001 });
  const b = eventAt('e2', { placeId: null, name: null, formattedAddress: null, latitude: 32.050004, longitude: 34.750004 });
  assert.equal(resolveVenueKey(a), resolveVenueKey(b));
});
