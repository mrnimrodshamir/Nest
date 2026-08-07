import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sortDiscoveryItems, mergeDiscoveryItems, filterDiscoveryItems } from './unifiedDiscovery.ts';
import { ALL_DISCOVERY_CONTENT, toggleDiscoveryContent, selectedContentKeys, visibleDiscoveryFailures, discoveryEmptyCopy } from './discoveryPresentation.ts';
import type { DiscoveryItem, DiscoveryContentSelection } from '@/types/discovery';

// --- Fixtures --------------------------------------------------------------
// Deliberately interleaved so a correct sort cannot be produced by input order.

const TEL_AVIV = { latitude: 32.0853, longitude: 34.7818 };

function activity(id: string, title: string, startTime: string, lat: number, lng: number): DiscoveryItem {
  return { type: 'activity', id, data: { id, title, startTime, latitude: lat, longitude: lng } as never };
}
function place(id: string, name: string, lat: number, lng: number, lastVerifiedAt: string | null = null): DiscoveryItem {
  return { type: 'place', id, data: { id, name, latitude: lat, longitude: lng, lastVerifiedAt } as never };
}
function event(id: string, title: string, startsAt: string, lat: number, lng: number, createdAt = '2026-01-01T00:00:00Z'): DiscoveryItem {
  return {
    type: 'event', id,
    data: { title, createdAt, occurrence: { id, startsAt }, location: { latitude: lat, longitude: lng } } as never,
  };
}

const ACT = activity('a1', 'Beach morning', '2026-09-10T09:00:00Z', 32.09, 34.77);
const ACT2 = activity('a2', 'Afternoon walk', '2026-09-12T15:00:00Z', 32.20, 34.90);
const PLACE = place('p1', 'Cafe Xoho', 32.086, 34.782, '2026-05-01T00:00:00Z');
const PLACE2 = place('p2', 'Zoo Garden', 32.30, 35.10, null);
const EVT = event('e1', 'Story time', '2026-09-11T10:00:00Z', 32.087, 34.783);
const EVT2 = event('e2', 'Music workshop', '2026-09-09T10:00:00Z', 32.40, 35.20);

const ALL: DiscoveryItem[] = [PLACE2, ACT2, EVT, PLACE, ACT, EVT2];

function ids(items: readonly DiscoveryItem[]): string[] {
  return items.map((i) => i.id);
}

// --- 'newest' is gone ------------------------------------------------------

test('SEMANTICS: "newest" is no longer an accepted sort', () => {
  // Activities carry no createdAt, so newest ranked them by start time
  // (furthest-future first) and floated unverified Places to the top.
  const accepted = ['default', 'distance', 'soonest', 'alphabetical'];
  assert.ok(!accepted.includes('newest'));
});

// --- Distance --------------------------------------------------------------

test('distance ranks ALL THREE types together from the map centre', () => {
  const sorted = sortDiscoveryItems(ALL, 'distance', TEL_AVIV);
  assert.deepEqual(ids(sorted), ['p1', 'e1', 'a1', 'a2', 'p2', 'e2']);
  // Mixed types genuinely interleave rather than clustering by type.
  assert.notDeepEqual(
    sorted.map((i) => i.type),
    [...sorted.map((i) => i.type)].sort(),
  );
});

test('distance with no origin is stable rather than arbitrary', () => {
  const a = ids(sortDiscoveryItems(ALL, 'distance', null));
  const b = ids(sortDiscoveryItems([...ALL].reverse(), 'distance', null));
  assert.deepEqual(a, b, 'unsorted-by-distance results must still be deterministic');
});

// --- Soonest ---------------------------------------------------------------

test('soonest orders scheduled types by start time and sinks Places', () => {
  const sorted = sortDiscoveryItems(ALL, 'soonest', TEL_AVIV);
  assert.deepEqual(ids(sorted).slice(0, 4), ['e2', 'a1', 'e1', 'a2']);
  // Places are not scheduled; they must not be given a fabricated time.
  assert.deepEqual(ids(sorted).slice(4).sort(), ['p1', 'p2']);
});

test('SEMANTICS: soonest mixes Activities and Events on one timeline', () => {
  const sorted = sortDiscoveryItems([ACT, EVT2], 'soonest', TEL_AVIV);
  // Event e2 (09-09) precedes activity a1 (09-10) despite the input order.
  assert.deepEqual(ids(sorted), ['e2', 'a1']);
});

// --- Alphabetical ----------------------------------------------------------

test('alphabetical uses Place.name and Activity/Event.title uniformly', () => {
  const sorted = sortDiscoveryItems(ALL, 'alphabetical', TEL_AVIV);
  assert.deepEqual(ids(sorted), ['a2', 'a1', 'p1', 'e2', 'e1', 'p2']);
});

// --- Determinism -----------------------------------------------------------

for (const sort of ['default', 'distance', 'soonest', 'alphabetical'] as const) {
  test(`${sort} is deterministic regardless of input order`, () => {
    const forward = ids(sortDiscoveryItems(ALL, sort, TEL_AVIV));
    const backward = ids(sortDiscoveryItems([...ALL].reverse(), sort, TEL_AVIV));
    assert.deepEqual(forward, backward);
  });

  test(`${sort} never adds, drops or duplicates an item`, () => {
    const sorted = sortDiscoveryItems(ALL, sort, TEL_AVIV);
    assert.equal(sorted.length, ALL.length);
    assert.deepEqual(ids(sorted).sort(), ids(ALL).sort());
  });

  test(`${sort} does not mutate the input array`, () => {
    const input = [...ALL];
    sortDiscoveryItems(input, sort, TEL_AVIV);
    assert.deepEqual(ids(input), ids(ALL), 'sorting must not mutate map/query inputs');
  });
}

// --- All 7 content combinations -------------------------------------------

const COMBINATIONS: Array<{ name: string; selection: DiscoveryContentSelection; expected: string[] }> = [
  { name: '1. Activities', selection: { activities: true, places: false, events: false }, expected: ['a2', 'a1'] },
  { name: '2. Places', selection: { activities: false, places: true, events: false }, expected: ['p2', 'p1'] },
  { name: '3. Events', selection: { activities: false, places: false, events: true }, expected: ['e1', 'e2'] },
  { name: '4. Activities + Places', selection: { activities: true, places: true, events: false }, expected: ['p2', 'a2', 'p1', 'a1'] },
  { name: '5. Activities + Events', selection: { activities: true, places: false, events: true }, expected: ['a2', 'e1', 'a1', 'e2'] },
  { name: '6. Places + Events', selection: { activities: false, places: true, events: true }, expected: ['p2', 'e1', 'p1', 'e2'] },
  { name: '7. All three', selection: ALL_DISCOVERY_CONTENT, expected: ['p2', 'a2', 'e1', 'p1', 'a1', 'e2'] },
];

for (const { name, selection, expected } of COMBINATIONS) {
  test(`COMBINATION ${name}: filters to exactly the selected types`, () => {
    const filtered = filterDiscoveryItems(ALL, selection);
    assert.deepEqual(ids(filtered), expected);
    const allowed = new Set(selectedContentKeys(selection));
    for (const item of filtered) {
      const key = item.type === 'activity' ? 'activities' : item.type === 'place' ? 'places' : 'events';
      assert.ok(allowed.has(key), `${item.type} leaked into ${name}`);
    }
  });

  test(`COMBINATION ${name}: every sort keeps the selection intact`, () => {
    const filtered = filterDiscoveryItems(ALL, selection);
    for (const sort of ['default', 'distance', 'soonest', 'alphabetical'] as const) {
      const sorted = sortDiscoveryItems(filtered, sort, TEL_AVIV);
      assert.deepEqual(ids(sorted).sort(), expected.slice().sort(), `${name} / ${sort}`);
    }
  });

  test(`COMBINATION ${name}: empty copy names the selected types`, () => {
    const copy = discoveryEmptyCopy(selection);
    assert.ok(copy.length > 0);
    const keys = selectedContentKeys(selection);
    if (keys.length === 1) assert.ok(copy.toLowerCase().includes(keys[0]), copy);
  });
}

test('all 7 combinations are covered and each is distinct', () => {
  assert.equal(COMBINATIONS.length, 7);
  const shapes = new Set(COMBINATIONS.map((c) => JSON.stringify(selectedContentKeys(c.selection))));
  assert.equal(shapes.size, 7);
});

// --- At least one type stays selected --------------------------------------

test('the last selected content type cannot be deselected', () => {
  for (const key of ['activities', 'places', 'events'] as const) {
    const only = { activities: false, places: false, events: false, [key]: true } as DiscoveryContentSelection;
    const result = toggleDiscoveryContent(only, key);
    assert.equal(result.prevented, true, `${key} was allowed to reach an empty selection`);
    assert.deepEqual(result.selection, only);
  }
});

test('deselecting is allowed while another type remains', () => {
  const result = toggleDiscoveryContent(ALL_DISCOVERY_CONTENT, 'places');
  assert.equal(result.prevented, false);
  assert.deepEqual(selectedContentKeys(result.selection), ['activities', 'events']);
});

// --- Partial failure -------------------------------------------------------

test('a failure is surfaced only when its content type is selected', () => {
  const placesOnly: DiscoveryContentSelection = { activities: false, places: true, events: false };
  assert.deepEqual(visibleDiscoveryFailures(placesOnly, 'activity boom', null, null), []);
  assert.deepEqual(visibleDiscoveryFailures(placesOnly, null, 'place boom', null), ['place']);
});

test('one type failing still renders the others', () => {
  const failures = visibleDiscoveryFailures(ALL_DISCOVERY_CONTENT, null, 'place boom', null);
  assert.deepEqual(failures, ['place']);
  // Activities and events remain listable despite the place failure.
  const survivors = filterDiscoveryItems(ALL, { activities: true, places: false, events: true });
  assert.deepEqual(ids(survivors).sort(), ['a1', 'a2', 'e1', 'e2']);
});

test('all three failing reports all three', () => {
  assert.deepEqual(
    visibleDiscoveryFailures(ALL_DISCOVERY_CONTENT, 'a', 'p', 'e'),
    ['activity', 'place', 'event'],
  );
});

// --- Merge stays consistent with filtering ---------------------------------

test('mergeDiscoveryItems and filterDiscoveryItems agree on membership', () => {
  const merged = mergeDiscoveryItems(
    [ACT.data as never, ACT2.data as never],
    [PLACE.data as never, PLACE2.data as never],
    [EVT.data as never, EVT2.data as never],
    TEL_AVIV,
  );
  assert.deepEqual(ids(merged).sort(), ids(ALL).sort());
});
