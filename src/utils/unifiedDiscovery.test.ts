import assert from 'node:assert/strict';
import test from 'node:test';
import type { Activity } from '@/types/activity';
import type { FamilyFriendlyPlace } from '@/types/familyFriendlyPlace';
import type { EventDetails } from '@/types/event';
import { MOCK_EVENTS } from '@/mocks/mockEvents';
import {
  activityDiscoveryItem,
  discoveryCoordinateInViewport,
  discoveryItemKey,
  discoverySelectionEquals,
  filterDiscoveryItems,
  mergeDiscoveryItems,
  placeDiscoveryItem,
  eventDiscoveryItem,
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

const event = (id: string, latitude: number, startsAt = '2026-08-06T11:00:00Z'): EventDetails => ({
  ...MOCK_EVENTS[0],
  id: `event-${id}`,
  title: `Event ${id}`,
  location: { ...MOCK_EVENTS[0].location, latitude },
  occurrence: { ...MOCK_EVENTS[0].occurrence, id, eventId: `event-${id}`, startsAt },
});

test('typed factories retain domain data without merging database models', () => {
  const activityItem = activityDiscoveryItem(activity('same', 32.08));
  const placeItem = placeDiscoveryItem(place('same', 32.081));
  const eventItem = eventDiscoveryItem(event('same', 32.082));
  assert.equal(activityItem.type, 'activity');
  assert.equal(placeItem.type, 'place');
  assert.equal(eventItem.type, 'event');
  assert.equal(activityItem.data.category, 'stroller_walk');
  assert.equal(placeItem.data.category, 'park');
  assert.equal(eventItem.data.category, 'story_time');
});

test('stable keys include type so identical database ids never collide', () => {
  assert.equal(discoveryItemKey(activityDiscoveryItem(activity('same', 32.08))), 'activity:same');
  assert.equal(discoveryItemKey(placeDiscoveryItem(place('same', 32.08))), 'place:same');
  assert.equal(discoveryItemKey(eventDiscoveryItem(event('same', 32.08))), 'event:same');
});

test('Activity presentation uses the exact shared viewport boundary', () => {
  const viewport = { north: 32.1, south: 32.06, east: 34.8, west: 34.76 };
  assert.equal(discoveryCoordinateInViewport({ latitude: 32.08, longitude: 34.78 }, viewport), true);
  assert.equal(discoveryCoordinateInViewport({ latitude: 32.1, longitude: 34.8 }, viewport), true);
  assert.equal(discoveryCoordinateInViewport({ latitude: 32.1001, longitude: 34.78 }, viewport), false);
});

test('All, Activities, Places, and Events filters affect only presentation type', () => {
  const items = mergeDiscoveryItems([activity('a', 32.08)], [place('p', 32.081)], [event('e', 32.082)], { latitude: 32.08, longitude: 34.78 });
  assert.equal(filterDiscoveryItems(items, 'all').length, 3);
  assert.deepEqual(filterDiscoveryItems(items, 'activities').map((item) => item.type), ['activity']);
  assert.deepEqual(filterDiscoveryItems(items, 'places').map((item) => item.type), ['place']);
  assert.deepEqual(filterDiscoveryItems(items, 'events').map((item) => item.type), ['event']);
});

test('items are blended by type-neutral distance from the current map centre', () => {
  const items = mergeDiscoveryItems(
    [activity('far-activity', 32.09), activity('near-activity', 32.0802)],
    [place('middle-place', 32.084)],
    [event('near-event', 32.0804)],
    { latitude: 32.08, longitude: 34.78 },
  );
  assert.deepEqual(items.map(discoveryItemKey), ['activity:near-activity', 'event:near-event', 'place:middle-place', 'activity:far-activity']);
});

test('exact distance ties use Activity time, Place name, then typed stable id', () => {
  const activities = [activity('late', 32.08, '2026-08-06T12:00:00Z'), activity('early', 32.08, '2026-08-06T09:00:00Z')];
  const places = [place('z', 32.08, 'Zoo'), place('a', 32.08, 'Ariela')];
  const events = [event('late-event', 32.08, '2026-08-06T13:00:00Z'), event('early-event', 32.08, '2026-08-06T08:00:00Z')];
  const items = mergeDiscoveryItems(activities, places, events, { latitude: 32.08, longitude: 34.78 });
  assert.deepEqual(items.filter((item) => item.type === 'activity').map((item) => item.id), ['early', 'late']);
  assert.deepEqual(items.filter((item) => item.type === 'place').map((item) => item.id), ['a', 'z']);
  assert.deepEqual(items.filter((item) => item.type === 'event').map((item) => item.id), ['early-event', 'late-event']);
});

test('without a valid centre, natural per-type order is deterministically interleaved', () => {
  const items = mergeDiscoveryItems(
    [activity('late', 32.08, '2026-08-06T12:00:00Z'), activity('early', 32.08, '2026-08-06T09:00:00Z')],
    [place('z', 32.08, 'Zoo'), place('a', 32.08, 'Ariela')],
    [event('late-event', 32.08, '2026-08-06T13:00:00Z'), event('early-event', 32.08, '2026-08-06T08:00:00Z')],
    null,
  );
  assert.deepEqual(items.map(discoveryItemKey), ['activity:early', 'place:a', 'event:early-event', 'activity:late', 'place:z', 'event:late-event']);
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
  const merged = mergeDiscoveryItems(activityFiltered, places, [], { latitude: 32.08, longitude: 34.78 });
  assert.equal(merged.filter((item) => item.type === 'activity').length, 1);
  assert.equal(merged.filter((item) => item.type === 'place').length, 1);
});

test('a Place-only filter never removes Activities from the merged All feed', () => {
  const activities = [activity('walk', 32.08)];
  const places = [place('park', 32.081), { ...place('museum', 32.082), category: 'museum' as const }];
  const placeFiltered = places.filter((item) => item.category === 'museum');
  const merged = mergeDiscoveryItems(activities, placeFiltered, [], { latitude: 32.08, longitude: 34.78 });
  assert.equal(merged.filter((item) => item.type === 'activity').length, 1);
  assert.equal(merged.filter((item) => item.type === 'place').length, 1);
});
