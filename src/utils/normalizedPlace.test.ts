import assert from 'node:assert/strict';
import test from 'node:test';
import { createAppleMapsPlace, createLegacyPlace, createManualPlace } from './normalizedPlace.ts';

test('normalizes an Apple provider result without raw provider data', () => {
  assert.deepEqual(createAppleMapsPlace({ name: 'Café Xoho', formattedAddress: '17 Gordon St', latitude: 32.083, longitude: 34.773, category: 'Cafe', providerPlaceId: 'apple-1' }), {
    name: 'Café Xoho', formattedAddress: '17 Gordon St', latitude: 32.083, longitude: 34.773, category: 'Cafe', provider: 'apple_maps', providerPlaceId: 'apple-1', source: 'provider', wasAdjusted: false,
  });
});

test('normalizes manual and legacy points without provider metadata', () => {
  assert.equal(createManualPlace({ latitude: 32.08, longitude: 34.78 }).name, 'Meeting point');
  const legacy = createLegacyPlace({ addressLabel: 'Old park entrance', latitude: 32.09, longitude: 34.79 });
  assert.equal(legacy.source, 'legacy');
  assert.equal(legacy.provider, null);
  assert.equal(legacy.formattedAddress, 'Old park entrance');
});

test('safely supports missing address, category and place ID', () => {
  const place = createAppleMapsPlace({ name: 'Park', latitude: 32, longitude: 34 });
  assert.equal(place.formattedAddress, null);
  assert.equal(place.category, null);
  assert.equal(place.providerPlaceId, null);
});

test('rejects malformed coordinates', () => {
  assert.throws(() => createManualPlace({ latitude: 91, longitude: 34 }), RangeError);
  assert.throws(() => createLegacyPlace({ addressLabel: 'x', latitude: 32, longitude: Number.NaN }), RangeError);
});

test('preserves Hebrew and English names', () => {
  assert.equal(createAppleMapsPlace({ name: 'פארק הירקון', latitude: 32.1, longitude: 34.8 }).name, 'פארק הירקון');
  assert.equal(createAppleMapsPlace({ name: 'Hayarkon Park', latitude: 32.1, longitude: 34.8 }).name, 'Hayarkon Park');
});
