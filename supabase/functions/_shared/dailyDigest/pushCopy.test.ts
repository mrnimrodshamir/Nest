import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDigestPushCopy, buildWeeklyDigestPushCopy, buildWeekendDigestPushCopy, DIGEST_LOCALES, isDigestLocale } from './pushCopy.ts';

test('every one of the six shipping locales has distinct push copy', () => {
  const titles = DIGEST_LOCALES.map((locale) => buildDigestPushCopy(locale, 5).title);
  assert.equal(new Set(titles).size, DIGEST_LOCALES.length, 'two locales share a title');
});

test('body text reflects the actual event count, not a hardcoded number', () => {
  for (const locale of DIGEST_LOCALES) {
    const three = buildDigestPushCopy(locale, 3).body;
    const five = buildDigestPushCopy(locale, 5).body;
    assert.notEqual(three, five, `${locale} body did not change with count`);
    assert.match(three, /3/, `${locale} 3-event body missing the number`);
    assert.match(five, /5/, `${locale} 5-event body missing the number`);
  }
});

test('an unrecognized or missing locale falls back to English, never an empty push', () => {
  for (const bad of [null, undefined, '', 'de', 'klingon']) {
    const copy = buildDigestPushCopy(bad as string, 4);
    assert.equal(copy.title, buildDigestPushCopy('en', 4).title);
    assert.ok(copy.title.length > 0 && copy.body.length > 0);
  }
});

test('isDigestLocale correctly identifies the six shipping locales only', () => {
  for (const locale of DIGEST_LOCALES) assert.equal(isDigestLocale(locale), true, locale);
  assert.equal(isDigestLocale('de'), false);
  assert.equal(isDigestLocale(null), false);
  assert.equal(isDigestLocale(undefined), false);
});

test('Hebrew and Arabic copy uses their own script, not a transliteration', () => {
  assert.match(buildDigestPushCopy('he', 3).title, /[֐-׿]/);
  assert.match(buildDigestPushCopy('ar', 3).title, /[؀-ۿ]/);
});

test('no locale leaks a raw {count} placeholder into the rendered body', () => {
  for (const locale of DIGEST_LOCALES) {
    for (const count of [1, 2, 3, 5]) {
      assert.doesNotMatch(buildDigestPushCopy(locale, count).body, /\{count\}/, `${locale}/${count}`);
    }
  }
});

test('Weekly copy exists naturally in all six locales with RTL scripts preserved', () => {
  for (const locale of DIGEST_LOCALES) {
    const copy = buildWeeklyDigestPushCopy(locale, 14);
    assert.ok(copy.title.length > 10 && copy.body.length > 10, locale);
  }
  assert.match(buildWeeklyDigestPushCopy('he', 14).title, /[֐-׿]/);
  assert.match(buildWeeklyDigestPushCopy('ar', 14).title, /[؀-ۿ]/);
});

test('Weekend copy exists in all six locales with Hebrew and Arabic RTL scripts', () => {
  for (const locale of DIGEST_LOCALES) {
    const copy = buildWeekendDigestPushCopy(locale, 6);
    assert.ok(copy.title.length > 8 && copy.body.length > 10, locale);
  }
  assert.match(buildWeekendDigestPushCopy('he', 6).title, /[֐-׿]/);
  assert.match(buildWeekendDigestPushCopy('ar', 6).title, /[؀-ۿ]/);
});
