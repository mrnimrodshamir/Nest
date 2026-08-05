import assert from 'node:assert/strict';
import test from 'node:test';
import type { Activity } from '@/types/activity';
import type { FamilyFriendlyPlace } from '@/types/familyFriendlyPlace';
import {
  activityDiscoveryItem,
  discoveryItemKey,
  discoverySelectionEquals,
  filterDiscoveryItems,
  mergeDiscoveryItems,
  placeDiscoveryItem,
} from '@/utils/unifiedDiscovery';

const activity = (id: string, latitude: number, startTime = '2026-08-06T10:00:00Z'): Activity => ({
  id,
  hostId: 'host',
  title: `Activity ${id}`,
  category: 'stroller_walk',
  coverImageUrl: null,
  status: 'published',
  startTime,
  durationMinutes: 60,
  distanceKm: 0,
  latitude,
  longitude: 34.78,
  attendees: [],
  attendeeCount: 1,
  capacity: 8,
  babyMinAgeMonths: null,
  babyMaxAgeMonths: null,
});

const place = (id: string, latitude: number, name = `Place ${id}`): FamilyFriendlyPlace => ({
  id,
  name,
  slug: id,
  category: 'park',
  shortDescription: null,
  fullDescription: null,
  latitude,
  longitude: 34.78,
  formattedAddress: null,
  neighborhood: null,
  city: 'Tel Aviv',
  countryCode: 'IL',
  provider: null,
  providerPlaceId: null,
  websiteUrl: null,
  phone: null,
  coverImageUrl: null,
  galleryImageUrls: null,
  isIndoor: null,
  isOutdoor: true,
  isFree: null,
  priceNote: null,
  minAgeMonths: null,
  maxAgeMonths: null,
  strollerFriendly: null,
  changingTable: null,
  highChairs: null,
  toilets: null,
  shade: null,
  waterFountain: null,
  accessible: null,
  parkingNote: null,
  openingHours: null,
  sourceName: null,
  sourceUrl: null,
  verificationStatus: 'verified',
  lastVerifiedAt: null,
  isActive: true,
  distanceMeters: null,
});

test('typed factories retain domain data without merging database models', () => {
  const activityItem = activityDiscoveryItem(activity('same', 32.08));
  const placeItem = placeDiscoveryItem(place('same', 32.081));
  assert.equal(activityItem.type, 'activity');
  assert.equal(placeItem.type, 'place');
  assert.equal(activityItem.data.category, 'stroller_walk');
  assert.equal(placeItem.data.category, 'park');
});

test('stable keys include type so identical database ids never collide', () => {
  assert.equal(discoveryItemKey(activityDiscoveryItem(activity('same', 32.08))), 'activity:same');
  assert.equal(discoveryItemKey(placeDiscoveryItem(place('same', 32.08))), 'place:same');
});

test('All, Activities, and Places filters affect only presentation type', () => {
  const items = mergeDiscoveryItems([activity('a', 32.08)], [place('p', 32.081)], { latitude: 32.08, longitude: 34.78 });
  assert.equal(filterDiscoveryItems(items, 'all').length, 2);
  assert.deepEqual(filterDiscoveryItems(items, 'activities').map((item) => item.type), ['activity']);
  assert.deepEqual(filterDiscoveryItems(items, 'places').map((item) => item.type), ['place']);
});

test('items are blended by type-neutral distance from the current map centre', () => {
  const items = mergeDiscoveryItems(
    [activity('far-activity', 32.09), activity('near-activity', 32.0802)],
    [place('middle-place', 32.084)],
    { latitude: 32.08, longitude: 34.78 },
  );
  assert.deepEqual(items.map(discoveryItemKey), ['activity:near-activity', 'place:middle-place', 'activity:far-activity']);
});

test('without a valid centre, natural per-type order is deterministically interleaved', () => {
  const items = mergeDiscoveryItems(
    [activity('late', 32.08, '2026-08-06T12:00:00Z'), activity('early', 32.08, '2026-08-06T09:00:00Z')],
    [place('z', 32.08, 'Zoo'), place('a', 32.08, 'Ariela')],
    null,
  );
  assert.deepEqual(items.map(discoveryItemKey), ['activity:early', 'place:a', 'activity:late', 'place:z']);
});

test('marker and card selection use the same typed identity', () => {
  const activityItem = activityDiscoveryItem(activity('same', 32.08));
  const placeItem = placeDiscoveryItem(place('same', 32.08));
  assert.equal(discoverySelectionEquals({ type: 'activity', id: 'same' }, activityItem), true);
  assert.equal(discoverySelectionEquals({ type: 'activity', id: 'same' }, placeItem), false);
});

test('an Activity-only filter never removes Places from the merged All feed', () => {
  const activities = [activity('walk', 32.08), { ...activity('yoga', 32.081), category: 'yoga' as const }];
  const places = [place('park', 32.082)];
  const activityFiltered = activities.filter((item) => item.category === 'yoga');
  const merged = mergeDiscoveryItems(activityFiltered, places, { latitude: 32.08, longitude: 34.78 });
  assert.equal(merged.filter((item) => item.type === 'activity').length, 1);
  assert.equal(merged.filter((item) => item.type === 'place').length, 1);
});

test('a Place-only filter never removes Activities from the merged All feed', () => {
  const activities = [activity('walk', 32.08)];
  const places = [place('park', 32.081), { ...place('museum', 32.082), category: 'museum' as const }];
  const placeFiltered = places.filter((item) => item.category === 'museum');
  const merged = mergeDiscoveryItems(activities, placeFiltered, { latitude: 32.08, longitude: 34.78 });
  assert.equal(merged.filter((item) => item.type === 'activity').length, 1);
  assert.equal(merged.filter((item) => item.type === 'place').length, 1);
});
