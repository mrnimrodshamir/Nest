import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePriceText } from './priceParsing.ts';

test('a real Beit Ariela price string parses with the prefix stripped', () => {
  assert.deepEqual(parsePriceText('מחיר: 20 ₪'), { priceNote: '20 ₪', isFree: false });
});

test('an explicit free-entry statement is read as free, and ONLY when the source says so', () => {
  assert.deepEqual(parsePriceText('כניסה חופשית'), { priceNote: 'כניסה חופשית', isFree: true });
  assert.deepEqual(parsePriceText('ללא עלות'), { priceNote: 'ללא עלות', isFree: true });
});

test('a dollar or euro amount is still recognized as a real price', () => {
  assert.deepEqual(parsePriceText('$15'), { priceNote: '$15', isFree: false });
});

// ===========================================================================
// UNKNOWN PRICE — never fabricate "free" or "varies"
// ===========================================================================

test('null input is unknown', () => {
  assert.deepEqual(parsePriceText(null), { priceNote: null, isFree: null });
});

test('text with no currency signal and no free-entry phrase is unknown, not assumed free', () => {
  assert.deepEqual(parsePriceText('מחיר: יפורסם בקרוב'), { priceNote: null, isFree: null });
});

test('unknown price is null, never false — false would assert "this costs money" without support', () => {
  const result = parsePriceText('פרטים בהמשך');
  assert.equal(result.isFree, null);
  assert.notEqual(result.isFree, false);
});
