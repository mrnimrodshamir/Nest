import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import type { DiscoveryItem } from '@/types/discovery';
import { discoveryMapPointerEvents, handleDiscoveryItemIntent, nextDiscoveryMapGeneration, shouldRefreshDiscoveryMapForAppState } from '@/utils/discoveryScreenState';

function eventItem(): Extract<DiscoveryItem, { type: 'event' }> {
  return {
    type: 'event',
    id: 'occurrence-34',
    data: {
      occurrence: { id: 'occurrence-34' },
    } as never,
  };
}

test('BUILD 34 REGRESSION: opening an Event never runs native preview commands before navigation', () => {
  const calls: string[] = [];
  const item = eventItem();

  assert.doesNotThrow(() => handleDiscoveryItemIntent(item, 'open', {
    // Models Build 34's MapView/BottomSheet command boundary. Its open path
    // called this first, so a released/unavailable native ref aborted before
    // navigation. This deliberate throw makes that old implementation fail.
    preview: () => { throw new Error('Failed to animateToRegion'); },
    trackOpen: () => calls.push('track'),
    openActivity: () => calls.push('activity'),
    openPlace: () => calls.push('place'),
    openEvent: (opened) => calls.push(`event:${opened.id}`),
  }));

  assert.deepEqual(calls, ['track', 'event:occurrence-34']);
});

test('marker preview still performs the native focus operation without navigating', () => {
  const calls: string[] = [];
  handleDiscoveryItemIntent(eventItem(), 'preview', {
    preview: () => calls.push('preview'),
    trackOpen: () => calls.push('track'),
    openActivity: () => calls.push('activity'),
    openPlace: () => calls.push('place'),
    openEvent: () => calls.push('event'),
  });
  assert.deepEqual(calls, ['preview']);
});

test('BUILD 37 REGRESSION: map markers are static, easy to tap, and open without preview commands', async () => {
  const discovery = await readFile(new URL('../screens/DiscoverScreen.tsx', import.meta.url), 'utf8');
  const markers = await Promise.all([
    '../components/ActivityMapPin.tsx',
    '../components/PlaceMapPin.tsx',
    '../components/EventMapPin.tsx',
    '../components/PlaceClusterMarker.tsx',
  ].map((path) => readFile(new URL(path, import.meta.url), 'utf8')));

  for (const marker of markers) {
    assert.match(marker, /tracksViewChanges=\{false\}/);
    assert.match(marker, /hitTarget: \{ width: 52, height: 52/);
    assert.doesNotMatch(marker, /tracksViewChanges=\{selected\}/);
  }
  const markerHandler = discovery.slice(discovery.indexOf('const openMarkerItem'), discovery.indexOf('const changeContentSelection'));
  assert.match(markerHandler, /setSelectedItem/);
  assert.match(markerHandler, /MARKER_OPEN_DELAY_MS/);
  assert.match(markerHandler, /openItem\(item\)/);
  assert.doesNotMatch(markerHandler, /animateToRegion|snapToIndex|scrollToIndex/);
});

test('BUILD 39 REGRESSION: Discovery never tears MapKit down during navigation', async () => {
  const discovery = await readFile(new URL('../screens/DiscoverScreen.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(discovery, /MAP_BLUR_UNMOUNT_DELAY_MS|setMapMounted|mapMounted/);
  assert.match(discovery, /pointerEvents=\{discoveryMapPointerEvents\(isFocused\)\}/);
  const mapTag = discovery.slice(discovery.indexOf('\n      <MapView'), discovery.indexOf('</MapView>'));
  assert.doesNotMatch(mapTag, /pointerEvents=/, 'the native MapView must never own the transient navigation lock');
  for (const prop of ['scrollEnabled', 'zoomEnabled', 'rotateEnabled', 'pitchEnabled']) {
    assert.match(mapTag, new RegExp(`\\b${prop}\\b`), `${prop} must remain enabled`);
  }
});

test('BUILD 38 P0: returning from every detail type restores map touches on focus', () => {
  for (const type of ['event', 'activity', 'place'] as const) {
    assert.equal(discoveryMapPointerEvents(true), 'auto', `${type}: map starts interactive`);
    assert.equal(discoveryMapPointerEvents(false), 'none', `${type}: background map is safely suppressed`);
    assert.equal(discoveryMapPointerEvents(true), 'auto', `${type}: back navigation deterministically releases the lock`);
  }
});

test('BUILD 39 P0: every away-and-back cycle replaces the native map responder', async () => {
  let generation = 0;
  assert.equal(nextDiscoveryMapGeneration(generation, false), 0, 'first focus keeps the initial map');
  for (let cycle = 1; cycle <= 10; cycle += 1) {
    generation = nextDiscoveryMapGeneration(generation, true);
    assert.equal(generation, cycle);
  }

  const discovery = await readFile(new URL('../screens/DiscoverScreen.tsx', import.meta.url), 'utf8');
  assert.match(discovery, /key=\{`discovery-map-\$\{mapGeneration\}`\}/);
  assert.match(discovery, /mapBlurredSinceLastFocus\.current = true/);
  assert.match(discovery, /nextDiscoveryMapGeneration\(current, mapBlurredSinceLastFocus\.current\)/);
});

test('BUILD 39 P0: foregrounding refreshes a stale native map responder', () => {
  assert.equal(shouldRefreshDiscoveryMapForAppState('background', 'active'), true);
  assert.equal(shouldRefreshDiscoveryMapForAppState('inactive', 'active'), true);
  assert.equal(shouldRefreshDiscoveryMapForAppState('active', 'active'), false);
  assert.equal(shouldRefreshDiscoveryMapForAppState('active', 'background'), false);
});
