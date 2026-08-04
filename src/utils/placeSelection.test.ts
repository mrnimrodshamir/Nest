import assert from 'node:assert/strict';
import test from 'node:test';
import { createAppleMapsPlace, createManualPlace } from './normalizedPlace.ts';
import { legacyFieldsToSelectedLocation, normalizedPlaceToSelectedLocation, selectedLocationToNormalizedPlace } from './activityPlaceMapping.ts';
import { presentSelectedLocation } from './locationPresentation.ts';
import { selectProviderPlace } from './placeSelection.ts';

test('provider result selection updates complete state and map camera', () => {
  const place = createAppleMapsPlace({ name: 'Café Xoho', formattedAddress: '17 Gordon Street, Tel Aviv', latitude: 32.08, longitude: 34.77, category: 'Cafe', providerPlaceId: 'p1' });
  const selected = selectProviderPlace(place);
  assert.equal(selected.selection.place?.providerPlaceId, 'p1');
  assert.equal(selected.selection.source, 'provider');
  assert.equal(selected.selection.wasAdjusted, false);
  assert.equal(selected.cameraRegion.latitude, place.latitude);
  assert.equal(selected.cameraRegion.longitude, place.longitude);
});

test('create mode supports a manual normalized location', () => {
  const selected = normalizedPlaceToSelectedLocation(createManualPlace({ name: 'Park entrance', latitude: 32.1, longitude: 34.8 }));
  assert.equal(selected.place, null);
  assert.equal(selectedLocationToNormalizedPlace(selected).source, 'manual');
});

test('edit legacy activity remains valid and provider edit retains metadata', () => {
  const legacy = legacyFieldsToSelectedLocation({ addressLabel: 'Old park', latitude: 32.1, longitude: 34.8 });
  assert.equal(legacy.source, 'legacy');
  const provider = selectProviderPlace(createAppleMapsPlace({ name: 'Museum', latitude: 32.2, longitude: 34.9, providerPlaceId: 'museum' })).selection;
  assert.equal(selectedLocationToNormalizedPlace(provider).providerPlaceId, 'museum');
});

test('Review presentation avoids duplicate address and never shows adjusted provider venue', () => {
  const provider = selectProviderPlace(createAppleMapsPlace({ name: 'Museum', formattedAddress: 'Museum', latitude: 32.2, longitude: 34.9 })).selection;
  assert.equal(presentSelectedLocation(provider).address, null);
  const adjusted = { ...provider, place: null, source: 'manual' as const, wasAdjusted: true, displayName: 'Old venue', addressLabel: 'Hayarkon Park, Tel Aviv' };
  assert.deepEqual(presentSelectedLocation(adjusted), { title: 'Selected meeting point', address: 'Hayarkon Park, Tel Aviv', isManuallyAdjusted: true });
});

