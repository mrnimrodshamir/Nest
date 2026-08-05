import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import {
  contentFilterIncludes,
  discoveryEmptyCopy,
  transitionDiscoveryContentFilter,
  visibleDiscoveryFailures,
} from '@/utils/discoveryPresentation';

test('content filter transition clears selection and preserves the exact map camera', () => {
  const region = { latitude: 32.08, longitude: 34.78, latitudeDelta: 0.04, longitudeDelta: 0.04 };
  const transition = transitionDiscoveryContentFilter(region, 'places');
  assert.strictEqual(transition.region, region);
  assert.equal(transition.contentFilter, 'places');
  assert.equal(transition.selectedItem, null);
});

test('content inclusion and empty copy cover All, Activities, Places, and Events', () => {
  assert.equal(contentFilterIncludes('all', 'activity'), true);
  assert.equal(contentFilterIncludes('all', 'place'), true);
  assert.equal(contentFilterIncludes('all', 'event'), true);
  assert.equal(contentFilterIncludes('activities', 'place'), false);
  assert.equal(contentFilterIncludes('places', 'activity'), false);
  assert.equal(contentFilterIncludes('events', 'event'), true);
  assert.equal(discoveryEmptyCopy('all'), 'No activities, places, or events found in this area.');
  assert.equal(discoveryEmptyCopy('activities'), 'No activities match these filters.');
  assert.equal(discoveryEmptyCopy('places'), 'No places match these filters.');
  assert.equal(discoveryEmptyCopy('events'), 'No events match these filters.');
});

test('partial failures remain scoped to visible content and never imply a full-screen failure', () => {
  assert.deepEqual(visibleDiscoveryFailures('all', 'activity failed', null), ['activity']);
  assert.deepEqual(visibleDiscoveryFailures('all', null, 'place failed'), ['place']);
  assert.deepEqual(visibleDiscoveryFailures('places', 'activity failed', null), []);
  assert.deepEqual(visibleDiscoveryFailures('activities', null, 'place failed'), []);
  assert.deepEqual(visibleDiscoveryFailures('events', 'activity failed', 'place failed', 'event failed'), ['event']);
});

test('Discovery renders one map and one typed feed with both domain cards and markers', () => {
  const source = readFileSync(new URL('../screens/DiscoverScreen.tsx', import.meta.url), 'utf8');
  assert.equal((source.match(/<MapView\s/g) ?? []).length, 1);
  for (const component of ['ActivityMapPin', 'PlaceMapPin', 'EventMapPin', 'ActivityCard', 'PlaceCard', 'EventCard']) assert.match(source, new RegExp(`<${component}\\b`));
  assert.match(source, /keyExtractor={discoveryItemKey}/);
  assert.match(source, /QueryErrorBanner/);
  assert.equal(existsSync(new URL('../screens/PlacesDiscoveryView.tsx', import.meta.url)), false);
});

test('place images use shared fixed variants, category artwork, and cached broken-URL fallback', () => {
  const source = readFileSync(new URL('../components/PlaceImage.tsx', import.meta.url), 'utf8');
  const shared = readFileSync(new URL('../components/ContentImage.tsx', import.meta.url), 'utf8');
  assert.match(source, /<ContentImage/);
  assert.match(shared, /contentFit="cover"/);
  assert.match(shared, /onError=/);
  assert.match(shared, /cachePolicy="memory-disk"/);
  assert.match(source, /aspectRatio: 4 \/ 3/);
  assert.match(source, /CATEGORY_ART/);
  assert.match(source, /<CategoryArtwork/);
});

test('Discovery exposes Search, Filters, and Sort in its compact toolbar', () => {
  const source = readFileSync(new URL('../screens/DiscoverScreen.tsx', import.meta.url), 'utf8');
  assert.match(source, /label="Search"/);
  assert.match(source, /label="Filters"/);
  assert.match(source, /label="Sort"/);
  assert.match(source, /<ModalSheet visible={filtersOpen}/);
  assert.match(source, /Sorting changes the list only/);
});
