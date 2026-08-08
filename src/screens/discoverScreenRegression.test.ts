import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyContentSelectionChange, resetContentSelection } from '@/utils/discoveryScreenState';
import { sortDiscoveryItems } from '@/utils/unifiedDiscovery';
import type { DiscoveryContentSelection, DiscoveryItem } from '@/types/discovery';

const source = readFileSync(new URL('./DiscoverScreen.tsx', import.meta.url), 'utf8');
const ALL: DiscoveryContentSelection = { activities: true, places: true, events: true };

// --- Content selection: camera, refetch, and stale selection ---------------

test('a content-type change never issues a refetch of cached domains', () => {
  for (const key of ['activities', 'places', 'events'] as const) {
    const hide = applyContentSelectionChange({ selection: ALL, selectedItem: null }, key);
    assert.deepEqual(hide.refetch, [], `hiding ${key} refetched`);
    const show = applyContentSelectionChange({ selection: hide.selection, selectedItem: null }, key);
    assert.deepEqual(show.refetch, [], `re-showing ${key} refetched`);
  }
});

test('CAMERA: the selection reducer cannot express a region change', () => {
  const result = applyContentSelectionChange({ selection: ALL, selectedItem: null }, 'places');
  // Structural guarantee: region is not part of this state slice at all.
  assert.ok(!('region' in result));
  assert.deepEqual(Object.keys(result).sort(), ['prevented', 'refetch', 'selectedItem', 'selection']);
});

test('CAMERA: the screen does not setRegion when content selection changes', () => {
  const handler = source.slice(source.indexOf('const changeContentSelection'));
  const body = handler.slice(0, handler.indexOf('}, ['));
  assert.ok(!/setRegion|animateToRegion|animateCamera/.test(body), 'selection change moved the camera');
});

test('hiding a type clears a selected marker OF THAT TYPE', () => {
  const result = applyContentSelectionChange(
    { selection: ALL, selectedItem: { type: 'place', id: 'p1' } },
    'places',
  );
  assert.equal(result.selectedItem, null);
});

test('hiding a type leaves a selection of a DIFFERENT type alone', () => {
  const result = applyContentSelectionChange(
    { selection: ALL, selectedItem: { type: 'activity', id: 'a1' } },
    'places',
  );
  assert.deepEqual(result.selectedItem, { type: 'activity', id: 'a1' });
});

test('re-showing a hidden type does not resurrect the dropped selection', () => {
  const hidden = applyContentSelectionChange(
    { selection: ALL, selectedItem: { type: 'place', id: 'p1' } },
    'places',
  );
  const shown = applyContentSelectionChange(hidden, 'places');
  assert.equal(shown.selectedItem, null);
});

test('a prevented change leaves every part of the state untouched', () => {
  const only: DiscoveryContentSelection = { activities: true, places: false, events: false };
  const selectedItem = { type: 'activity', id: 'a1' } as const;
  const result = applyContentSelectionChange({ selection: only, selectedItem }, 'activities');
  assert.equal(result.prevented, true);
  assert.deepEqual(result.selection, only);
  assert.deepEqual(result.selectedItem, selectedItem);
});

test('reset restores all three content types', () => {
  assert.deepEqual(resetContentSelection(), ALL);
});

// --- Sort affects the list only -------------------------------------------

const ITEMS: DiscoveryItem[] = [
  { type: 'activity', id: 'a1', data: { id: 'a1', title: 'Beach', startTime: '2026-09-10T09:00:00Z', latitude: 32.09, longitude: 34.77 } as never },
  { type: 'place', id: 'p1', data: { id: 'p1', name: 'Cafe', latitude: 32.086, longitude: 34.782, lastVerifiedAt: null } as never },
];

test('sorting returns a NEW array and leaves the source (map) array intact', () => {
  const original = [...ITEMS];
  for (const sort of ['default', 'distance', 'soonest', 'alphabetical'] as const) {
    const sorted = sortDiscoveryItems(ITEMS, sort, { latitude: 32.0853, longitude: 34.7818 });
    assert.notStrictEqual(sorted, ITEMS, `${sort} returned the same reference`);
    assert.deepEqual(ITEMS.map((i) => i.id), original.map((i) => i.id), `${sort} mutated the input`);
  }
});

test('MARKERS: the map renders from the unsorted item set', () => {
  // Anchor on the JSX tag, not the `useRef<MapView>` type argument that
  // appears earlier in the file.
  const open = source.search(/<MapView[\s\n]/);
  const close = source.indexOf('</MapView>');
  assert.ok(open >= 0 && close > open, 'could not locate the MapView block');
  const markerRegion = source.slice(open, close);
  // listItems is the SORTED projection; markers must read the unsorted set so
  // changing sort order cannot move a pin.
  assert.ok(!markerRegion.includes('listItems'), 'map markers were driven by the sorted list');
  // Places reach the map via placeMapItems, which clusters visiblePlaces
  // geographically — still the unsorted set.
  for (const memo of ['visibleActivities', 'placeMapItems', 'visibleEvents']) {
    assert.ok(markerRegion.includes(memo), `${memo} not rendered on the map`);
  }
});

test('MARKERS: place clustering is geographic, never sort-dependent', () => {
  const line = source.split('\n').find((l) => l.includes('const placeMapItems =')) ?? '';
  assert.ok(line.includes('visiblePlaces'), 'clusters are not built from the unsorted places');
  assert.ok(line.includes('region'), 'clustering ignores the map region');
  assert.ok(!line.includes('sort'), 'clustering depends on the sort order');
});

test('MARKERS: the unsorted memos are derived without any sort', () => {
  for (const memo of ['visibleActivities', 'visiblePlaces', 'visibleEvents']) {
    const line = source.split('\n').find((l) => l.includes(`const ${memo} =`)) ?? '';
    assert.ok(line.includes('visibleItems'), `${memo} is not derived from visibleItems`);
    assert.ok(!line.includes('sort'), `${memo} applied a sort`);
  }
});

test('sorting the list does not touch the query inputs', () => {
  const handler = source.slice(source.indexOf('SORT_OPTIONS.map'));
  const onPress = handler.slice(0, handler.indexOf('</View>'));
  assert.ok(/setSort\(/.test(onPress));
  assert.ok(!/setRegion|refresh\(|loadMore/.test(onPress), 'changing sort triggered a query');
});

// --- Sheet lifecycle -------------------------------------------------------

test('the filter sheet is conditionally rendered, so dismissing unmounts it', () => {
  assert.match(source, /\{filtersOpen \? <ModalSheet/);
  assert.match(source, /setFiltersOpen\(false\)/);
});

test('the sort sheet is conditionally rendered, so dismissing unmounts it', () => {
  assert.match(source, /\{sortOpen \? <ModalSheet/);
  assert.match(source, /setSortOpen\(false\)/);
});

// --- Loading and partial failure ------------------------------------------

test('cached content suppresses the skeleton, so a refresh never blanks the list', () => {
  assert.match(source, /const hasCachedContent = visibleItems\.length > 0/);
  assert.match(source, /showSkeleton = !hasCachedContent/);
});

test('each domain failure renders its own banner rather than a full-screen error', () => {
  for (const domain of ['Activity', 'Place', 'Event']) {
    assert.match(source, new RegExp(`show${domain}Error \\? <QueryErrorBanner`), domain);
  }
  // The list keeps rendering regardless of which banners are shown.
  assert.match(source, /<BottomSheetFlatList/);
});

// --- Header stays minimal --------------------------------------------------

test('the closed header exposes only Search, Filters and Sort', () => {
  // The controls moved into the sheet header to become sticky; the invariant
  // (exactly three, nothing permanently expanded) is unchanged.
  const toolbar = source.slice(source.indexOf('<View style={styles.toolbarSticky}>'));
  const block = toolbar.slice(0, toolbar.indexOf('</View>'));
  const buttons = block.match(/<ToolbarButton/g) ?? [];
  assert.equal(buttons.length, 3, 'the closed header grew extra permanent controls');
  for (const key of ['discovery.search', 'discovery.filters', 'discovery.sort']) {
    assert.ok(block.includes(key), `${key} missing from the header`);
  }
});

// --- Type-specific filter sections are scoped to the selection ------------

test('a type-specific filter section only renders when its type is selected', () => {
  for (const key of ['activities', 'places', 'events'] as const) {
    assert.match(source, new RegExp(`contentSelection\\.${key} \\?`), key);
  }
});
