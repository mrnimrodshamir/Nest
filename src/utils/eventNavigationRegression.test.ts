import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import type { DiscoveryItem } from '@/types/discovery';
import { handleDiscoveryItemIntent } from '@/utils/discoveryScreenState';

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

test('BUILD 37 REGRESSION: Discovery delays MapKit teardown until navigation settles', async () => {
  const discovery = await readFile(new URL('../screens/DiscoverScreen.tsx', import.meta.url), 'utf8');
  assert.match(discovery, /MAP_BLUR_UNMOUNT_DELAY_MS = 700/);
  assert.match(discovery, /setTimeout\(\(\) => setMapMounted\(false\), MAP_BLUR_UNMOUNT_DELAY_MS\)/);
  assert.match(discovery, /mapMounted \? <MapView/);
  assert.match(discovery, /pointerEvents=\{isFocused \? 'auto' : 'none'\}/);
});
