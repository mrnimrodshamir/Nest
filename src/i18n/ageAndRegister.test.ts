import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SUPPORTED_LOCALES, setActiveDateLocale } from './core.ts';
import { formatAgeRange, formatBabyAge } from '@/utils/babyAge.ts';

// ===========================================================================
// AGE FORMATTING — EN / HE / FR / RU
// ===========================================================================

test('Hebrew age is grammatical WITHOUT guessing gender', () => {
  setActiveDateLocale('he');
  // No stored gender: no prefix at all. "גיל 4 חודשים" was the old output and
  // reads like a form field rather than one parent talking to another.
  assert.equal(formatBabyAge(4, 'he', null), '4 חודשים');
  assert.equal(formatBabyAge(1, 'he', null), 'חודש');
  assert.equal(formatBabyAge(2, 'he', null), 'חודשיים');
  assert.equal(formatBabyAge(12, 'he', null), 'שנה');
  assert.equal(formatBabyAge(24, 'he', null), 'שנתיים');
  assert.equal(formatBabyAge(25, 'he', null), 'שנתיים וחודש');
  assert.equal(formatBabyAge(36, 'he', null), '3 שנים');
});

test('Hebrew age uses בן/בת only when the gender is actually stored', () => {
  setActiveDateLocale('he');
  assert.equal(formatBabyAge(36, 'he', 'male'), 'בן 3');
  assert.equal(formatBabyAge(36, 'he', 'female'), 'בת 3');
  assert.equal(formatBabyAge(4, 'he', 'male'), 'בן 4 חודשים');
  assert.equal(formatBabyAge(25, 'he', 'female'), 'בת שנתיים וחודש');
});

test('the Hebrew "and" takes a maqaf before a numeral and not before a word', () => {
  setActiveDateLocale('he');
  assert.equal(formatBabyAge(25, 'he', null), 'שנתיים וחודש');       // word
  assert.equal(formatBabyAge(39, 'he', null), '3 שנים ו־3 חודשים');  // numeral
});

test('no Hebrew age string ever shows the bare word גיל followed by a unit', () => {
  setActiveDateLocale('he');
  for (const months of [1, 2, 4, 6, 12, 18, 24, 25, 36, 39, 60]) {
    for (const sex of [null, 'male', 'female'] as const) {
      assert.doesNotMatch(formatBabyAge(months, 'he', sex), /גיל \d/, `${months}/${sex}`);
    }
  }
});

test('French uses the SINGULAR for one year — "1 ans" was reaching the screen', () => {
  setActiveDateLocale('fr');
  assert.equal(formatBabyAge(12, 'fr', null), '1 an');
  assert.equal(formatBabyAge(24, 'fr', null), '2 ans');
  assert.equal(formatBabyAge(1, 'fr', null), '1 mois');
  assert.equal(formatAgeRange(null, 12), 'Jusqu’à 1 an');
  assert.equal(formatAgeRange(12, null), '1 an et plus');
});

test('every locale produces a non-empty age with no leftover placeholder', () => {
  for (const locale of SUPPORTED_LOCALES) {
    setActiveDateLocale(locale);
    for (const months of [1, 2, 6, 12, 24, 25, 39]) {
      const value = formatBabyAge(months, locale, null);
      assert.ok(value.trim().length > 0, `${locale}/${months} empty`);
      assert.doesNotMatch(value, /\{\w+\}/, `${locale}/${months} left a placeholder`);
      assert.doesNotMatch(value, /^\s|\s$/, `${locale}/${months} has stray whitespace`);
    }
  }
  setActiveDateLocale('en');
});

// ===========================================================================
// HEBREW REGISTER — one voice, not one-string-at-a-time translation
// ===========================================================================

const hebrew = readFileSync(new URL('./he.ts', import.meta.url), 'utf8');

test('Hebrew addresses parents in the plural throughout', () => {
  // An ambiguous English "you" translated string-by-string is how a dictionary
  // ends up mixing שלך and שלכם on adjacent screens.
  const singular = hebrew.match(/שלך|איתך|אליך|עליך/g) ?? [];
  assert.deepEqual(singular, [], `singular second-person forms found: ${singular.join(', ')}`);
});

test('Hebrew avoids the municipal-form register', () => {
  for (const phrase of ['יש לבחור', 'יש להשאיר', 'יש להזין', 'נא ל']) {
    assert.ok(!hebrew.includes(phrase), `"${phrase}" is form-filling register, not consumer copy`);
  }
});

test('Hebrew imperatives are plural, never singular masculine', () => {
  for (const phrase of ['השתמש ', 'בחר ', 'הזן ', 'לחץ ', 'נסה '] ) {
    assert.ok(!hebrew.includes(`'${phrase}`), `singular imperative "${phrase.trim()}" found`);
  }
});
