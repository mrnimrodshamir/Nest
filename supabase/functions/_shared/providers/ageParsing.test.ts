import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHebrewAgeRange } from './ageParsing.ts';

test('a real Beit Ariela audience string parses correctly — "לגילי 6-3" is high-to-low', () => {
  assert.deepEqual(parseHebrewAgeRange('לגילי 6-3'), { ageMinMonths: 36, ageMaxMonths: 72 });
});

test('the reverse order "לגילי 3-6" parses identically — order never matters', () => {
  assert.deepEqual(parseHebrewAgeRange('לגילי 3-6'), { ageMinMonths: 36, ageMaxMonths: 72 });
});

test('an explicit month range is read as months, not years', () => {
  assert.deepEqual(parseHebrewAgeRange('3-6 חודשים'), { ageMinMonths: 3, ageMaxMonths: 6 });
});

test('open-ended "מגיל 3" sets only a minimum', () => {
  assert.deepEqual(parseHebrewAgeRange('מגיל 3'), { ageMinMonths: 36, ageMaxMonths: null });
});

test('open-ended "עד גיל 6" sets only a maximum', () => {
  assert.deepEqual(parseHebrewAgeRange('עד גיל 6'), { ageMinMonths: null, ageMaxMonths: 72 });
});

// ===========================================================================
// UNKNOWN AGE — the default, and it must stay the default
// ===========================================================================

test('null input is unknown, not zero', () => {
  assert.deepEqual(parseHebrewAgeRange(null), { ageMinMonths: null, ageMaxMonths: null });
});

test('empty/whitespace-only text is unknown', () => {
  assert.deepEqual(parseHebrewAgeRange('   '), { ageMinMonths: null, ageMaxMonths: null });
});

test('text with no recognizable age pattern is unknown rather than guessed', () => {
  assert.deepEqual(parseHebrewAgeRange('מתאים לכל המשפחה'), { ageMinMonths: null, ageMaxMonths: null });
});

test('a bare number with no age-marking words is unknown, not misread as an age', () => {
  assert.deepEqual(parseHebrewAgeRange('20 ₪'), { ageMinMonths: null, ageMaxMonths: null });
});
