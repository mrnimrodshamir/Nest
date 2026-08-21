import assert from 'node:assert/strict';
import test from 'node:test';
import { CITIES, resolveCityForCoordinate } from './cities.ts';

test('Ramat Gan config has six locales and production-safe metadata', () => {
  const city = CITIES.ramat_gan;
  assert.deepEqual(Object.keys(city.displayNames).sort(), ['ar','en','es','fr','he','ru']);
  assert.equal(city.timezone, 'Asia/Jerusalem');
  assert.equal(city.currency, 'ILS');
  assert.equal(city.digestEnabled, false);
  assert.equal(city.boundary.sourceCode, '8600');
});

test('official boundary distinguishes Ramat Gan from Tel Aviv and outside metro', () => {
  assert.equal(resolveCityForCoordinate(32.082076, 34.80393), 'ramat_gan'); // Beit Doron
  assert.equal(resolveCityForCoordinate(32.096963, 34.816551), 'ramat_gan'); // Beit HaTzanchan
  assert.equal(resolveCityForCoordinate(32.0714, 34.81), 'givatayim');
  assert.equal(resolveCityForCoordinate(32.0809, 34.7806), 'tel_aviv');
  assert.equal(resolveCityForCoordinate(31.77, 35.21), null);
});

test('invalid coordinates are not assigned a city', () => {
  assert.equal(resolveCityForCoordinate(Number.NaN, 34.8), null);
});
