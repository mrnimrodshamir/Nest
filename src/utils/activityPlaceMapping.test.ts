import assert from 'node:assert/strict';
import test from 'node:test';
import {
  activityColumnsToNormalizedPlace,
  legacyFieldsToSelectedLocation,
  normalizedPlaceToColumns,
  normalizedPlaceToSelectedLocation,
  selectedLocationToNormalizedPlace,
} from './activityPlaceMapping.ts';
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

test('provider place maps to distinct selected-location UI state and back', () => {
  const place = createAppleMapsPlace({ name: 'Café Xoho', formattedAddress: '17 Gordon St', latitude: 32.08, longitude: 34.77, category: 'Cafe', providerPlaceId: 'p1' });
  const selection = normalizedPlaceToSelectedLocation(place);
  assert.equal(selection.place, place);
  assert.equal(selection.displayName, 'Café Xoho');
  assert.equal(selection.addressLabel, '17 Gordon St');
  assert.deepEqual(selectedLocationToNormalizedPlace(selection), place);
});

test('manual and legacy selection state does not duplicate provider metadata', () => {
  const legacy = legacyFieldsToSelectedLocation({ addressLabel: 'Old park entrance', latitude: 32.1, longitude: 34.8 });
  assert.equal(legacy.place, null);
  assert.equal(legacy.source, 'legacy');
  const manual = { ...legacy, source: 'manual' as const, displayName: 'Selected meeting point', wasAdjusted: true };
  const normalized = selectedLocationToNormalizedPlace(manual);
  assert.equal(normalized.provider, null);
  assert.equal(normalized.providerPlaceId, null);
  assert.equal(normalized.wasAdjusted, true);
});
