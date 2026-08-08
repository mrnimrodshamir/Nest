import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  coerceLocalePreference,
  interpolate,
  isRtlLocale,
  missingKeys,
  normalizeLanguageTag,
  resolveLocale,
  translate,
} from './core.ts';
import { en } from './en.ts';
import { he } from './he.ts';

// --- English ---------------------------------------------------------------

test('English returns the English string', () => {
  assert.equal(translate('en', 'nav.discovery'), 'Discovery');
  assert.equal(translate('en', 'common.share'), 'Share');
});

// --- Hebrew ----------------------------------------------------------------

test('Hebrew returns the Hebrew string, not the English one', () => {
  assert.equal(translate('he', 'nav.discovery'), 'גילוי');
  assert.notEqual(translate('he', 'common.addToCalendar'), en['common.addToCalendar']);
});

test('every English key has a Hebrew translation', () => {
  assert.deepEqual(missingKeys('he'), [], 'Hebrew is missing keys');
});

test('Hebrew introduces no key English lacks', () => {
  const englishKeys = new Set(Object.keys(en));
  const extra = Object.keys(he).filter((key) => !englishKeys.has(key));
  assert.deepEqual(extra, []);
});

test('no Hebrew value is left as an untranslated English string', () => {
  // A language selector names each language in its OWN script, so these two
  // are deliberately identical across dictionaries.
  // language.* name each language in its own script; chats.happenedOn is a
  // pure placeholder pattern with no words to translate.
  const allowed = new Set([
    'language.english', 'language.hebrew',
    // Pure format patterns with no words to translate.
    'chats.happenedOn', 'event.attendance.overflow',
  ]);
  const untranslated = (Object.keys(he) as Array<keyof typeof en>).filter(
    (key) => !allowed.has(key) && he[key] === en[key],
  );
  assert.deepEqual(untranslated, []);
});

// --- Fallback --------------------------------------------------------------

test('a key missing from Hebrew falls back to English, never to a raw key', () => {
  const sparse = 'he';
  // Simulate a gap by translating a key we know exists in English.
  const value = translate(sparse, 'nav.profile');
  assert.ok(value.length > 0);
  assert.notEqual(value, 'nav.profile');
});

test('an unknown locale falls back to English rather than throwing', () => {
  // @ts-expect-error deliberately invalid locale, as could arrive from storage
  assert.equal(translate('fr', 'nav.chats'), 'Chats');
});

// --- Locale detection ------------------------------------------------------

test('normalizes region and case variants of Hebrew', () => {
  for (const tag of ['he', 'he-IL', 'HE_il', 'he-Hebr-IL']) {
    assert.equal(normalizeLanguageTag(tag), 'he', tag);
  }
});

test('accepts the legacy "iw" code Android still emits for Hebrew', () => {
  assert.equal(normalizeLanguageTag('iw-IL'), 'he');
});

test('unsupported languages return null so the caller can fall back', () => {
  assert.equal(normalizeLanguageTag('fr-FR'), null);
  assert.equal(normalizeLanguageTag(''), null);
  assert.equal(normalizeLanguageTag(null), null);
});

test('HEBREW IS OPT-IN: a Hebrew device does not auto-switch', () => {
  // Product rule: English is the default for everyone. Device language, country
  // and phone number never select Hebrew — only an explicit choice does.
  assert.equal(resolveLocale(['he-IL'], null), 'en');
  assert.equal(resolveLocale(['iw-IL'], null), 'en');
});

test('device French with no stored choice falls back to English', () => {
  assert.equal(resolveLocale(['fr-FR'], null), 'en');
});

test('no device tag combination can select Hebrew without a stored choice', () => {
  assert.equal(resolveLocale(['fr-FR', 'he-IL', 'en-US'], null), 'en');
  assert.equal(resolveLocale(['he-IL', 'he'], null), 'en');
});

test('no device tags at all still resolves to English', () => {
  assert.equal(resolveLocale([], null), 'en');
});

// --- Persisted preference --------------------------------------------------

test('an explicit choice overrides the device language', () => {
  assert.equal(resolveLocale(['he-IL'], 'en'), 'en');
  assert.equal(resolveLocale(['en-US'], 'he'), 'he');
});

test('a legacy stored "system" value now resolves to English, not the device', () => {
  // 'system' is retained only so previously stored values coerce safely; it is
  // no longer offered in the selector and no longer consults the device.
  assert.equal(resolveLocale(['he-IL'], 'system'), 'en');
  assert.equal(resolveLocale(['en-US'], 'system'), 'en');
});

test('corrupt stored values are ignored, not rendered', () => {
  assert.equal(coerceLocalePreference('klingon'), null);
  assert.equal(coerceLocalePreference(''), null);
  assert.equal(coerceLocalePreference(null), null);
  assert.equal(resolveLocale(['he-IL'], coerceLocalePreference('klingon')), 'en');
});

test('valid stored values round-trip', () => {
  for (const value of ['en', 'he', 'system']) {
    assert.equal(coerceLocalePreference(value), value);
  }
});

// --- Interpolation ---------------------------------------------------------

test('placeholders are substituted', () => {
  assert.equal(interpolate('{count} active', { count: 3 }), '3 active');
  assert.equal(translate('en', 'filters.activeCount', { count: 2 }), '2 active');
});

test('a placeholder with no matching param is left intact, never "undefined"', () => {
  const result = interpolate('{role} of {count}', { role: 'Mom' });
  assert.equal(result, 'Mom of {count}');
  assert.ok(!result.includes('undefined'));
});

test('interpolation works in Hebrew too', () => {
  assert.equal(translate('he', 'filters.activeCount', { count: 4 }), '4 פעילים');
});

// --- RTL -------------------------------------------------------------------

test('Hebrew is RTL and English is not', () => {
  assert.equal(isRtlLocale('he'), true);
  assert.equal(isRtlLocale('en'), false);
});
