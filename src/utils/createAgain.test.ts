import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCreateAgainSeed, canCreateAgain } from './createAgain.ts';
import type { ActivityDetail } from '../types/activity.ts';

function previousActivity(): ActivityDetail & Record<string, unknown> {
  return {
    id: 'original-id',
    hostId: 'host-1',
    title: 'Old title',
    category: 'picnic',
    coverImageUrl: 'https://example.test/original-cover.jpg',
    status: 'completed',
    startTime: '2026-01-01T10:00:00.000Z',
    durationMinutes: 90,
    distanceKm: 0,
    latitude: 32.1,
    longitude: 34.8,
    attendees: [{ id: 'guest', displayName: 'Guest', avatarUrl: null, avatarColor: '#fff' }],
    attendeeCount: 2,
    capacity: 8,
    babyMinAgeMonths: 3,
    babyMaxAgeMonths: 18,
    description: 'Bring a blanket',
    notes: 'Meet by the trees',
    host: { id: 'host-1', displayName: 'Host', avatarUrl: null, avatarColor: '#fff', verified: false, bio: null },
    location: { label: 'The park entrance', latitude: 32.2, longitude: 34.9 },
    viewerStatus: 'going',
    hostChildIds: ['deleted-child'],
    chat: { id: 'old-chat' },
    messages: [{ id: 'old-message' }],
    createdAt: '2025-01-01',
  };
}

test('Create Again is only offered for a completed activity hosted by the viewer', () => {
  assert.equal(canCreateAgain(true, 'completed'), true);
  assert.equal(canCreateAgain(false, 'completed'), false);
  assert.equal(canCreateAgain(true, 'upcoming'), false);
  assert.equal(canCreateAgain(true, 'in_progress'), false);
  assert.equal(canCreateAgain(true, 'cancelled'), false);
});

test('safe fields are copied without mutating the original activity', () => {
  const original = previousActivity();
  const snapshot = structuredClone(original);
  const seed = buildCreateAgainSeed(original);
  assert.deepEqual(original, snapshot);
  assert.deepEqual(seed, {
    activityType: 'picnic',
    description: 'Bring a blanket',
    durationMinutes: 90,
    latitude: 32.2,
    longitude: 34.9,
    locationName: 'The park entrance',
    maxParticipants: 8,
    babyMinAgeMonths: 3,
    babyMaxAgeMonths: 18,
    notes: 'Meet by the trees',
    coverImageUrl: 'https://example.test/original-cover.jpg',
  });
});

test('identity, date, status, attendance, child ids, chat and messages cannot be copied', () => {
  const seed = buildCreateAgainSeed(previousActivity());
  const forbidden = [
    'id', 'title', 'startTime', 'startsAt', 'status', 'attendees', 'attendeeCount',
    'hostChildIds', 'chat', 'messages', 'createdAt', 'updatedAt',
  ];
  for (const key of forbidden) assert.equal(key in seed, false, `${key} must not be in the seed`);
});

test('deleted children are excluded because again mode receives no stale child ids', () => {
  const seed = buildCreateAgainSeed(previousActivity());
  assert.equal('hostChildIds' in seed, false);
});

test('the insert seed contains no id, so Supabase generates a new activity id', () => {
  const seed = buildCreateAgainSeed(previousActivity());
  assert.equal('id' in seed, false);
  assert.equal((seed as Record<string, unknown>).id, undefined);
});

test('again mode copies provider location metadata into an independent selection state', () => {
  const original = previousActivity();
  original.location.selection = {
    place: { name: 'Museum', formattedAddress: 'Tel Aviv', latitude: 32.2, longitude: 34.9, category: 'Museum', provider: 'apple_maps', providerPlaceId: 'p1', source: 'provider', wasAdjusted: false },
    latitude: 32.2,
    longitude: 34.9,
    displayName: 'Museum',
    addressLabel: 'Tel Aviv',
    source: 'provider',
    wasAdjusted: false,
  };
  const seed = buildCreateAgainSeed(original);
  assert.deepEqual(seed.selectedLocation, original.location.selection);
  assert.notEqual(seed.selectedLocation, original.location.selection);
  assert.notEqual(seed.selectedLocation?.place, original.location.selection.place);
});
