import assert from 'node:assert/strict';
import test from 'node:test';
import { adjustProviderPlace, distanceMeters, PLACE_ADJUSTMENT_TOLERANCE_METERS } from './placeAdjustment.ts';
import { createAppleMapsPlace } from './normalizedPlace.ts';

const origin = { latitude: 32.0853, longitude: 34.7818 };
const northBy = (meters: number) => ({ latitude: origin.latitude + meters / 111_195, longitude: origin.longitude });

test('distance handles zero, below, exact, and above the adjustment threshold', () => {
  assert.equal(distanceMeters(origin, origin), 0);
  assert.ok(distanceMeters(origin, northBy(39)) < PLACE_ADJUSTMENT_TOLERANCE_METERS);
  assert.ok(Math.abs(distanceMeters(origin, northBy(40)) - 40) < 0.02);
  assert.ok(distanceMeters(origin, northBy(41)) > PLACE_ADJUSTMENT_TOLERANCE_METERS);
});

test('retains provider selection at or below 40 metres', () => {
  const selected = createAppleMapsPlace({ name: 'Café', latitude: origin.latitude, longitude: origin.longitude, providerPlaceId: 'p1' });
  const adjusted = adjustProviderPlace(selected, northBy(40));
  assert.equal(adjusted.providerPlaceId, 'p1');
  assert.equal(adjusted.source, 'provider');
  assert.equal(adjusted.wasAdjusted, false);
});

test('clears misleading provider metadata above 40 metres', () => {
  const selected = createAppleMapsPlace({ name: 'Café', latitude: origin.latitude, longitude: origin.longitude, category: 'Cafe', providerPlaceId: 'p1' });
  const adjusted = adjustProviderPlace(selected, northBy(41), 'Selected meeting point', 'Hayarkon Park');
  assert.equal(adjusted.provider, null);
  assert.equal(adjusted.providerPlaceId, null);
  assert.equal(adjusted.category, null);
  assert.equal(adjusted.source, 'manual');
  assert.equal(adjusted.wasAdjusted, true);
});

test('rejects invalid adjustment coordinates', () => {
  assert.throws(() => distanceMeters(origin, { latitude: 32, longitude: 181 }), RangeError);
});

