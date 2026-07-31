import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildPlaceResult } from './buildPlaceResult.ts';

test('buildPlaceResult: uses the reverse-geocoded name when present', () => {
  const result = buildPlaceResult({ latitude: 32.09, longitude: 34.78 }, 'HaYarkon Park', 'Tel Aviv-Yafo', 'fallback query', 0);
  assert.equal(result.name, 'HaYarkon Park');
  assert.equal(result.formattedAddress, 'Tel Aviv-Yafo');
  assert.equal(result.latitude, 32.09);
  assert.equal(result.longitude, 34.78);
});

test('buildPlaceResult: falls back to the typed query when reverse geocoding found no name', () => {
  const result = buildPlaceResult({ latitude: 32.09, longitude: 34.78 }, null, null, 'Dizengoff Square', 0);
  assert.equal(result.name, 'Dizengoff Square');
  assert.equal(result.formattedAddress, '');
});

test('buildPlaceResult: falls back on a whitespace-only name too', () => {
  const result = buildPlaceResult({ latitude: 0, longitude: 0 }, '   ', undefined, 'query text', 0);
  assert.equal(result.name, 'query text');
});

test('buildPlaceResult: id is stable and unique per coordinate+index', () => {
  const a = buildPlaceResult({ latitude: 1, longitude: 2 }, 'A', '', 'q', 0);
  const b = buildPlaceResult({ latitude: 1, longitude: 2 }, 'B', '', 'q', 1);
  assert.notEqual(a.id, b.id);
});
