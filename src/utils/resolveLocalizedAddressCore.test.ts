import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLocalizedAddressCore } from './resolveLocalizedAddressCore.ts';

const POINT = { latitude: 32.0644, longitude: 34.7714 };

test('he locale: requests a Hebrew-preferred reverse geocode from the provider', async () => {
  let requestedLocale: string | null = null;
  const label = await resolveLocalizedAddressCore(POINT, 'he', {
    reverseGeocodeViaProvider: async (point, locale) => {
      requestedLocale = locale;
      return { kind: 'address', address: { formattedAddress: 'יהודה הלוי 111', latitude: point.latitude, longitude: point.longitude } };
    },
    reverseGeocodeOnDevice: async () => { throw new Error('must not be reached — provider succeeded'); },
  });
  assert.equal(requestedLocale, 'he');
  assert.equal(label, 'יהודה הלוי 111');
});

test('en locale: requests English/default behavior from the provider', async () => {
  let requestedLocale: string | null = null;
  const label = await resolveLocalizedAddressCore(POINT, 'en', {
    reverseGeocodeViaProvider: async (point, locale) => {
      requestedLocale = locale;
      return { kind: 'address', address: { formattedAddress: 'Yehuda-Halevi Street 111', latitude: point.latitude, longitude: point.longitude } };
    },
    reverseGeocodeOnDevice: async () => { throw new Error('must not be reached — provider succeeded'); },
  });
  assert.equal(requestedLocale, 'en');
  assert.equal(label, 'Yehuda-Halevi Street 111');
});

test('Hebrew address formatting: Apple\'s own formatted string is passed through unmodified, never re-translated or re-assembled', async () => {
  const label = await resolveLocalizedAddressCore(POINT, 'he', {
    reverseGeocodeViaProvider: async () => ({ kind: 'address', address: { formattedAddress: 'רחוב יהודה הלוי 111, תל אביב-יפו', latitude: POINT.latitude, longitude: POINT.longitude } }),
    reverseGeocodeOnDevice: async () => { throw new Error('unused'); },
  });
  assert.equal(label, 'רחוב יהודה הלוי 111, תל אביב-יפו');
});

test('English fallback inside Hebrew UI: when Apple has no Hebrew data it returns English, and that is displayed as-is — never invented or transliterated', async () => {
  const label = await resolveLocalizedAddressCore(POINT, 'he', {
    reverseGeocodeViaProvider: async () => ({ kind: 'address', address: { formattedAddress: 'Yehuda-Halevi Street 111', latitude: POINT.latitude, longitude: POINT.longitude } }),
    reverseGeocodeOnDevice: async () => { throw new Error('unused'); },
  });
  assert.equal(label, 'Yehuda-Halevi Street 111');
});

test('coordinates passed to the provider are exactly the coordinates given — never altered', async () => {
  let seenPoint: { latitude: number; longitude: number } | null = null;
  await resolveLocalizedAddressCore(POINT, 'he', {
    reverseGeocodeViaProvider: async (point) => {
      seenPoint = point;
      return { kind: 'address', address: { formattedAddress: 'anything', latitude: point.latitude, longitude: point.longitude } };
    },
    reverseGeocodeOnDevice: async () => { throw new Error('unused'); },
  });
  assert.deepEqual(seenPoint, POINT);
});

test('network/provider failure falls back to the on-device geocoder, deduping name+street', async () => {
  const label = await resolveLocalizedAddressCore(POINT, 'he', {
    reverseGeocodeViaProvider: async () => { throw new Error('provider unreachable'); },
    reverseGeocodeOnDevice: async () => [{ name: '111 Yehuda-Halevi Street', street: 'Yehuda-Halevi Street' }],
  });
  assert.equal(label, '111 Yehuda-Halevi Street');
});

test('provider returns no address (Apple has nothing for this coordinate) falls back to the on-device geocoder', async () => {
  const label = await resolveLocalizedAddressCore(POINT, 'he', {
    reverseGeocodeViaProvider: async () => ({ kind: 'address', address: null }),
    reverseGeocodeOnDevice: async () => [{ name: 'Fallback Name', street: null }],
  });
  assert.equal(label, 'Fallback Name');
});

test('both provider and on-device geocoding fail: resolves to null rather than throwing — coordinates already saved separately are unaffected', async () => {
  const label = await resolveLocalizedAddressCore(POINT, 'he', {
    reverseGeocodeViaProvider: async () => { throw new Error('offline'); },
    reverseGeocodeOnDevice: async () => { throw new Error('offline'); },
  });
  assert.equal(label, null);
});
