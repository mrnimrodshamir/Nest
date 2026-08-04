import assert from 'node:assert/strict';
import test from 'node:test';
import { activityColumnsToNormalizedPlace, normalizedPlaceToColumns } from './activityPlaceMapping.ts';
import { createAppleMapsPlace } from './normalizedPlace.ts';

test('legacy rows remain readable using address_label and coordinates', () => {
  const place = activityColumnsToNormalizedPlace({ address_label: 'Legacy park', latitude: 32.1, longitude: 34.8 });
  assert.equal(place.name, 'Legacy park');
  assert.equal(place.source, 'legacy');
  assert.equal(place.provider, null);
});

test('nullable provider fields never erase legacy location values', () => {
  const place = activityColumnsToNormalizedPlace({ address_label: 'Existing address', latitude: 32.1, longitude: 34.8, place_name: null, formatted_address: null, place_category: null, place_provider: null, provider_place_id: null, location_source: null, location_was_adjusted: null });
  assert.equal(place.name, 'Existing address');
  assert.equal(place.latitude, 32.1);
});

test('provider-neutral columns map an Apple place without raw data', () => {
  const original = createAppleMapsPlace({ name: 'גן מאיר', formattedAddress: 'תל אביב', latitude: 32.073, longitude: 34.774, category: 'Park', providerPlaceId: 'apple-id' });
  assert.deepEqual(normalizedPlaceToColumns(original), { place_name: 'גן מאיר', formatted_address: 'תל אביב', place_category: 'Park', place_provider: 'apple_maps', provider_place_id: 'apple-id', location_source: 'provider', location_was_adjusted: false });
});

