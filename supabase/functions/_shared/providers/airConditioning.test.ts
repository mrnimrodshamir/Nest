import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAirConditioned } from './airConditioning.ts';

test('explicit "ממוזג" text is read as true', () => {
  assert.equal(parseAirConditioned('אולם ממוזג'), true);
});

test('explicit "ללא מיזוג" is read as false', () => {
  assert.equal(parseAirConditioned('ללא מיזוג אוויר'), false);
});

// ===========================================================================
// UNKNOWN AIR CONDITIONING — the required default for almost everything
// ===========================================================================

test('null input is unknown', () => {
  assert.equal(parseAirConditioned(null), null);
});

test('a library description that never mentions AC is unknown — NOT inferred true from the venue being an indoor building', () => {
  // This is the exact real text from the Beit Ariela fixture used elsewhere
  // in this test suite. It never mentions air conditioning, so this must be
  // null even though a library is, in the ordinary sense, indoors.
  const realDescription = 'מר צפרדע רוצה לצאת מהנחל המתוק ולטייל בעולם אך הפחד עוצר בעדו.';
  assert.equal(parseAirConditioned(realDescription), null);
});

test('a museum, mall or any other indoor-by-nature venue text still yields unknown without an explicit statement', () => {
  assert.equal(parseAirConditioned('מוזיאון תל אביב לאמנות מזמין אתכם לתערוכה חדשה'), null);
});
