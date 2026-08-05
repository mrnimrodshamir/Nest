import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import test from 'node:test';
import {
  ALL_DISCOVERY_CONTENT,
  contentSelectionIncludes,
  discoveryEmptyCopy,
  toggleDiscoveryContent,
  visibleDiscoveryFailures,
} from '@/utils/discoveryPresentation';

test('content types support every multi-selection while retaining at least one', () => {
  const withoutPlaces = toggleDiscoveryContent(ALL_DISCOVERY_CONTENT, 'places');
  assert.deepEqual(withoutPlaces.selection, { activities: true, places: false, events: true });
  const activitiesOnly = { activities: true, places: false, events: false };
  const prevented = toggleDiscoveryContent(activitiesOnly, 'activities');
  assert.equal(prevented.prevented, true);
  assert.strictEqual(prevented.selection, activitiesOnly);
});

test('content inclusion and empty copy cover combined and single selections', () => {
  assert.equal(contentSelectionIncludes(ALL_DISCOVERY_CONTENT, 'activity'), true);
  assert.equal(contentSelectionIncludes({ activities: true, places: false, events: true }, 'place'), false);
  assert.equal(contentSelectionIncludes({ activities: true, places: false, events: true }, 'event'), true);
  assert.equal(discoveryEmptyCopy(ALL_DISCOVERY_CONTENT), 'No activities, places, or events found in this area.');
  assert.equal(discoveryEmptyCopy({ activities: true, places: false, events: false }), 'No activities match these filters.');
  assert.equal(discoveryEmptyCopy({ activities: false, places: true, events: false }), 'No places match these filters.');
  assert.equal(discoveryEmptyCopy({ activities: false, places: false, events: true }), 'No events match these filters.');
});

test('partial failures remain scoped to visible content and never imply a full-screen failure', () => {
  assert.deepEqual(visibleDiscoveryFailures(ALL_DISCOVERY_CONTENT, 'activity failed', null), ['activity']);
  assert.deepEqual(visibleDiscoveryFailures(ALL_DISCOVERY_CONTENT, null, 'place failed'), ['place']);
  assert.deepEqual(visibleDiscoveryFailures({ activities: false, places: true, events: false }, 'activity failed', null), []);
  assert.deepEqual(visibleDiscoveryFailures({ activities: true, places: false, events: false }, null, 'place failed'), []);
  assert.deepEqual(visibleDiscoveryFailures({ activities: false, places: false, events: true }, 'activity failed', 'place failed', 'event failed'), ['event']);
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
  assert.match(source, /label={activeFilterCount \? `Filters · \$\{activeFilterCount\}` : 'Filters'}/);
  assert.match(source, /label="Sort"/);
  assert.match(source, /{filtersOpen \? <ModalSheet visible/);
  assert.match(source, /Sorting changes the list only/);
  assert.doesNotMatch(source, /DiscoveryContentFilter|CONTENT_FILTERS/);
  const filterSheetStart = source.indexOf('{filtersOpen ? <ModalSheet visible');
  const filterSheetEnd = source.indexOf('</ModalSheet>', filterSheetStart);
  const firstFilterRow = source.indexOf('<FilterRow');
  assert.ok(filterSheetStart > 0 && filterSheetEnd > filterSheetStart);
  assert.ok(firstFilterRow > filterSheetStart && firstFilterRow < filterSheetEnd, 'large filter rows render only inside the explicit filter sheet');
});
