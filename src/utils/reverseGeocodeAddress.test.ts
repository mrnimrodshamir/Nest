import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dedupeAddressLabel } from './reverseGeocodeAddress.ts';

/** Real device report: "Yehuda-Halevi Street 111 Yehuda-Halevi Street" —
 *  the on-device geocoder's `name` already contains the street, so blindly
 *  appending `street` again duplicated it. */
test('duplicate street component removal: name already contains street', () => {
  assert.equal(dedupeAddressLabel('111 Yehuda-Halevi Street', 'Yehuda-Halevi Street'), '111 Yehuda-Halevi Street');
});

test('duplicate street component removal: street contains name', () => {
  assert.equal(dedupeAddressLabel('Yehuda-Halevi', 'Yehuda-Halevi Street'), 'Yehuda-Halevi Street');
});

test('name and street are genuinely distinct: both are kept', () => {
  assert.equal(dedupeAddressLabel('HaYarkon Park', 'Rokach Boulevard'), 'HaYarkon Park Rokach Boulevard');
});

test('only a name is present', () => {
  assert.equal(dedupeAddressLabel('HaYarkon Park', null), 'HaYarkon Park');
});

test('only a street is present', () => {
  assert.equal(dedupeAddressLabel(null, 'Dizengoff Street'), 'Dizengoff Street');
});

test('neither is present', () => {
  assert.equal(dedupeAddressLabel(null, undefined), null);
});

test('comparison ignores case and surrounding whitespace', () => {
  assert.equal(dedupeAddressLabel('  111 YEHUDA-HALEVI STREET  ', 'yehuda-halevi street'), '111 YEHUDA-HALEVI STREET');
});
