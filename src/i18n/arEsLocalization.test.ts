import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { setActiveDateLocale, translate, isRtlLocale, dateLocaleTag, currentAppLocale } from './core.ts';
import { detectTextDirection, textAlignForContent, physicalEdge } from './rtl.ts';
import { formatAgeRange, formatBabyAge } from '@/utils/babyAge.ts';
import { generateActivityTitle } from '@/utils/generateActivityTitle.ts';
import { buildSupportMailtoUrl, SUPPORT_EMAIL } from '@/utils/supportContact.ts';

// ===========================================================================
// ARABIC RTL / SPANISH LTR
// ===========================================================================

test('Arabic is RTL, Spanish is LTR', () => {
  assert.equal(isRtlLocale('ar'), true);
  assert.equal(isRtlLocale('es'), false);
});

test('logical edges flip for Arabic but not for Spanish', () => {
  assert.equal(physicalEdge('start', 'ar'), 'right');
  assert.equal(physicalEdge('end', 'ar'), 'left');
  assert.equal(physicalEdge('start', 'es'), 'left');
  assert.equal(physicalEdge('end', 'es'), 'right');
});

// ===========================================================================
// CONTENT DIRECTION INSIDE ARABIC UI — UI locale != content direction
// ===========================================================================

test('an English username stays LTR inside an Arabic UI', () => {
  assert.equal(detectTextDirection('Daniel'), 'ltr');
  assert.equal(textAlignForContent('Daniel', 'ar').writingDirection, 'ltr');
  assert.equal(textAlignForContent('Daniel', 'ar').textAlign, 'left');
});

test('a Russian bio stays LTR inside an Arabic UI', () => {
  assert.equal(detectTextDirection('Привет, я мама двоих детей'), 'ltr');
});

test('an email address stays LTR inside an Arabic UI', () => {
  assert.equal(detectTextDirection('nimrodshamir@nestup.best'), 'ltr');
  assert.equal(textAlignForContent('nimrodshamir@nestup.best', 'ar').writingDirection, 'ltr');
});

test('an Arabic chat message renders RTL', () => {
  assert.equal(detectTextDirection('مرحبا، كيف حالك؟'), 'rtl');
  assert.equal(textAlignForContent('مرحبا، كيف حالك؟', 'ar').writingDirection, 'rtl');
  assert.equal(textAlignForContent('مرحبا، كيف حالك؟', 'ar').textAlign, 'right');
});

test('direction-neutral content (digits only) falls back to the UI locale', () => {
  assert.equal(detectTextDirection('123'), null);
  assert.equal(textAlignForContent('123', 'ar').writingDirection, 'rtl');
  assert.equal(textAlignForContent('123', 'es').writingDirection, 'ltr');
});

// ===========================================================================
// AGE FORMATTING — AR / ES
// ===========================================================================

test('Arabic and Spanish age strings are non-empty with no leftover placeholder', () => {
  for (const locale of ['ar', 'es'] as const) {
    for (const months of [1, 2, 6, 12, 24, 25, 39]) {
      const value = formatBabyAge(months, locale, null);
      assert.ok(value.trim().length > 0, `${locale}/${months} empty`);
      assert.doesNotMatch(value, /\{\w+\}/, `${locale}/${months} left a placeholder`);
    }
  }
});

test('Arabic age formatting never guesses gender — neutral phrasing regardless of stored sex', () => {
  // Arabic does not get Hebrew's special-cased gendered grammar branch; it
  // uses the same neutral years/months template every other new locale uses.
  const neutral = formatBabyAge(36, 'ar', null);
  assert.equal(formatBabyAge(36, 'ar', 'male'), neutral);
  assert.equal(formatBabyAge(36, 'ar', 'female'), neutral);
});

test('Spanish age range reads naturally', () => {
  setActiveDateLocale('es');
  assert.equal(formatAgeRange(null, 12), translate('es', 'age.upTo', { age: formatBabyAge(12, 'es', null) }));
  assert.equal(formatAgeRange(12, null), translate('es', 'age.andUp', { age: formatBabyAge(12, 'es', null) }));
  setActiveDateLocale('en');
});

// ===========================================================================
// DATE / TIME — AR / ES
// ===========================================================================

test('Arabic and Spanish each resolve to their own Gregorian date locale', () => {
  assert.equal(dateLocaleTag('ar'), 'ar-EG');
  assert.equal(dateLocaleTag('es'), 'es-ES');
});

test('the active date locale follows AR/ES selection, never the device', () => {
  setActiveDateLocale('ar');
  assert.equal(currentAppLocale(), 'ar');
  setActiveDateLocale('es');
  assert.equal(currentAppLocale(), 'es');
  setActiveDateLocale('en');
});

// ===========================================================================
// GENERATED ACTIVITY TITLES — AR / ES read like real activities, not enums
// ===========================================================================

test('generated activity titles are natural in Arabic and Spanish, never a leaked placeholder', () => {
  const now = new Date('2026-08-16T10:00:00+03:00');
  const tomorrow = new Date('2026-08-17T20:00:00+03:00');

  setActiveDateLocale('ar');
  const arabicTitle = generateActivityTitle('stroller_walk', tomorrow, 'Gordon Pool', now);
  assert.match(arabicTitle, /نزهة بعربة الأطفال/);
  assert.doesNotMatch(arabicTitle, /meeting point/i);

  setActiveDateLocale('es');
  const spanishTitle = generateActivityTitle('stroller_walk', tomorrow, 'Gordon Pool', now);
  assert.equal(spanishTitle, 'Paseo con coche mañana en Gordon Pool');

  setActiveDateLocale('en');
});

test('a dropped pin contributes no location to a generated title in Arabic or Spanish', () => {
  const now = new Date('2026-08-16T10:00:00+03:00');
  const tomorrow = new Date('2026-08-17T20:00:00+03:00');
  for (const locale of ['ar', 'es'] as const) {
    setActiveDateLocale(locale);
    const title = generateActivityTitle('stroller_walk', tomorrow, 'Meeting point', now);
    assert.doesNotMatch(title, /meeting point/i, locale);
  }
  setActiveDateLocale('en');
});

// ===========================================================================
// SUPPORT ROW — AR / ES copy exists, email stays LTR-safe, no private data
// ===========================================================================

test('the support row has Arabic and Spanish copy, distinct from English and each other', () => {
  const ar = translate('ar', 'profile.support.title');
  const es = translate('es', 'profile.support.title');
  const en = translate('en', 'profile.support.title');
  assert.notEqual(ar, en);
  assert.notEqual(es, en);
  assert.notEqual(ar, es);
});

test('the support mailto URL is identical in shape for AR/ES and carries no private data', () => {
  for (const locale of ['ar', 'es'] as const) {
    const url = buildSupportMailtoUrl(locale);
    assert.match(url, new RegExp(`^mailto:${SUPPORT_EMAIL.replace('.', '\\.').replace('@', '%40|@')}`));
    assert.ok(url.startsWith(`mailto:${SUPPORT_EMAIL}?subject=`), locale);
    assert.equal((url.match(/[?&]/g) ?? []).length, 1, `${locale} has more than one query param`);
  }
});

test('the support email itself renders LTR regardless of UI locale', () => {
  for (const locale of ['ar', 'es'] as const) {
    assert.equal(detectTextDirection(SUPPORT_EMAIL), 'ltr', locale);
  }
});

// ===========================================================================
// SPANISH LONG-STRING LAYOUT — no truncated/garbled short labels
// ===========================================================================

test('Spanish short UI labels stay short — no runaway translation on buttons/chips', () => {
  const es = readFileSync(new URL('./es.ts', import.meta.url), 'utf8');
  const shortKeys = ['common.save', 'common.cancel', 'common.done', 'common.back', 'common.share'];
  for (const key of shortKeys) {
    const match = es.match(new RegExp(`'${key}': '([^']+)'`));
    assert.ok(match, `${key} missing from es.ts`);
    assert.ok(match[1].length <= 20, `${key} is unexpectedly long in Spanish: "${match[1]}"`);
  }
});

// ===========================================================================
// ARABIC FORM ALIGNMENT — logical properties, not blind rowReverse
// ===========================================================================

test('primary stack screens mirror their navigation arrow, which also covers Arabic', () => {
  const files = [
    '../screens/ActivityDetailScreen.tsx', '../screens/CreateActivityScreen.tsx',
    '../screens/EditActivityScreen.tsx', '../screens/EditProfileScreen.tsx',
  ];
  for (const file of files) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    // isRTL is driven by core.isRtlLocale, which is now true for 'ar' too —
    // no per-file Arabic-specific branch is needed or wanted.
    assert.match(source, /isRTL \? styles\.flipped : undefined/, file);
  }
});
