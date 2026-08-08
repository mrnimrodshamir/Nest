import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parentAgeYears, hasDisplayableAge } from './parentAge.ts';
import { formatParentSubtitle } from './formatParentSubtitle.ts';
import { buildCaregiverContext } from './caregiverContext.ts';
import { resolveLocale } from '@/i18n/core';
import { CARD_MEDIA_MAX_HEIGHT, resolveCardRenderedHeight } from '@/constants/activityArtFrame';

const NOW = new Date('2026-08-08T12:00:00Z');

// ===========================================================================
// PARENT ROLE REGRESSION — Edit Profile said Dad, Profile said Parent
// ===========================================================================

test('REGRESSION: the selected role drives the profile subtitle', () => {
  const kids = [{ name: 'Go' }, { name: 'Yo' }, { name: 'Zo' }];
  assert.equal(formatParentSubtitle(kids, 'dad'), 'Dad of Go, Yo +1');
  assert.equal(formatParentSubtitle(kids, 'mom'), 'Mom of Go, Yo +1');
  assert.equal(formatParentSubtitle(kids, 'parent'), 'Parent of Go, Yo +1');
});

test('no role selected still reads neutrally — never inferred', () => {
  assert.equal(formatParentSubtitle([{ name: 'Go' }], null), 'Parent of Go');
  assert.equal(formatParentSubtitle([{ name: 'Go' }]), 'Parent of Go');
});

test('role applies at every child count', () => {
  assert.equal(formatParentSubtitle([{ name: 'Go' }], 'dad'), 'Dad of Go');
  assert.equal(formatParentSubtitle([{ name: 'Go' }, { name: 'Yo' }], 'dad'), 'Dad of Go and Yo');
});

test('no children still renders nothing, regardless of role', () => {
  assert.equal(formatParentSubtitle([], 'dad'), undefined);
  assert.equal(formatParentSubtitle(null, 'mom'), undefined);
});

test('ProfileScreen passes the stored role through', () => {
  const s = readFileSync(new URL('../screens/ProfileScreen.tsx', import.meta.url), 'utf8');
  assert.match(s, /formatParentSubtitle\(children,\s*profile\?\.parentRole/);
});

// ===========================================================================
// PARENT AGE — derived, never the birthdate
// ===========================================================================

test('age is whole years since the birthdate', () => {
  assert.equal(parentAgeYears('1999-01-01', NOW), 27);
  assert.equal(parentAgeYears('1990-08-08', NOW), 36);
});

test('a birthday later this year has not happened yet', () => {
  assert.equal(parentAgeYears('1999-12-31', NOW), 26);
  assert.equal(parentAgeYears('1999-08-09', NOW), 26);
  assert.equal(parentAgeYears('1999-08-08', NOW), 27, 'birthday today counts');
});

test('missing or malformed birthdates yield null, never a placeholder', () => {
  for (const bad of [null, undefined, '', 'not-a-date', 'yesterday']) {
    assert.equal(parentAgeYears(bad as string | null, NOW), null, String(bad));
  }
});

test('IMPOSSIBLE DATES: future birthdates never produce a negative age', () => {
  assert.equal(parentAgeYears('2030-01-01', NOW), null);
  assert.equal(parentAgeYears('2026-08-09', NOW), null);
});

test('implausible ages are suppressed at both ends', () => {
  assert.equal(parentAgeYears('2020-01-01', NOW), null, 'a 6-year-old cannot hold an account');
  assert.equal(parentAgeYears('1850-01-01', NOW), null);
  assert.equal(parentAgeYears('2013-01-01', NOW), 13, '13 is the boundary and is allowed');
});

test('age advances with the clock, not a stored value', () => {
  const before = parentAgeYears('2000-06-15', new Date('2026-06-14T00:00:00Z'));
  const after = parentAgeYears('2000-06-15', new Date('2026-06-15T00:00:00Z'));
  assert.equal(before, 25);
  assert.equal(after, 26);
});

test('hasDisplayableAge mirrors the derivation', () => {
  assert.equal(hasDisplayableAge('1999-01-01', NOW), true);
  assert.equal(hasDisplayableAge(null, NOW), false);
  assert.equal(hasDisplayableAge('2030-01-01', NOW), false);
});

// --- age in the trust line -------------------------------------------------

test('trust context reads "27 · Dad of 3 · Florentin"', () => {
  const c = buildCaregiverContext({
    ageYears: 27, parentRole: 'dad', childCount: 3, neighborhood: 'Florentin',
  });
  assert.equal(c.context, '27 · Dad of 3 · Florentin');
});

test('an unknown age is omitted, leaving no gap or separator', () => {
  const c = buildCaregiverContext({ parentRole: 'dad', childCount: 3, neighborhood: 'Florentin' });
  assert.equal(c.context, 'Dad of 3 · Florentin');
  assert.ok(!c.context?.startsWith('·'));
  assert.ok(!c.context?.includes('· ·'));
});

test('PRIVACY: no birthdate can reach the trust line', () => {
  const c = buildCaregiverContext({ ageYears: 27, parentRole: 'dad', childCount: 3 });
  assert.ok(!/\d{4}-\d{2}-\d{2}/.test(JSON.stringify(c)), 'a date leaked');
});

test('PRIVACY: the public profile query selects age_years, never birthdate', () => {
  const s = readFileSync(new URL('../hooks/usePublicProfile.ts', import.meta.url), 'utf8');
  assert.match(s, /age_years/);
  assert.ok(!/\bbirthdate\b/.test(s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')),
    'birthdate is referenced in the public profile query');
});

// ===========================================================================
// LANGUAGE — English default, Hebrew opt-in only
// ===========================================================================

test('ENGLISH IS DEFAULT with no stored preference, whatever the device says', () => {
  assert.equal(resolveLocale([], null), 'en');
  assert.equal(resolveLocale(['en-US'], null), 'en');
  assert.equal(resolveLocale(['fr-FR'], null), 'en');
});

test('HEBREW IS OPT-IN: a Hebrew device does not auto-switch', () => {
  assert.equal(resolveLocale(['he-IL'], null), 'en');
  assert.equal(resolveLocale(['he-IL', 'en-US'], null), 'en');
  assert.equal(resolveLocale(['iw-IL'], null), 'en');
});

test('an explicit choice wins and round-trips', () => {
  assert.equal(resolveLocale(['en-US'], 'he'), 'he');
  assert.equal(resolveLocale(['he-IL'], 'en'), 'en');
});

test('a legacy stored "system" value falls back to English, not the device', () => {
  assert.equal(resolveLocale(['he-IL'], 'system'), 'en');
});

// --- selector layout -------------------------------------------------------

const selector = readFileSync(new URL('../components/LanguageSelector.tsx', import.meta.url), 'utf8');

test('LAYOUT REGRESSION: labels cannot wrap to one character per line', () => {
  // The device bug was a flex:1 column inside a row that collapsed to zero
  // width. A hard line cap makes vertical letter-stacking impossible.
  assert.match(selector, /numberOfLines=\{1\}/);
  assert.match(selector, /alignSelf: 'stretch'/);
});

test('exactly two options, each named in its own script', () => {
  assert.match(selector, /key: 'en'/);
  assert.match(selector, /key: 'he'/);
  assert.ok(!/'system'/.test(selector), 'device-locale option is back in the user UI');
});

test('touch targets clear 44pt', () => {
  const m = selector.match(/minHeight:\s*(\d+)/);
  assert.ok(m && Number(m[1]) >= 44, `minHeight is ${m?.[1]}`);
});

// ===========================================================================
// CARD MEDIA — My Activities and Discovery share one bound
// ===========================================================================

test('card media is capped tighter than before, so cards stop dominating', () => {
  assert.equal(CARD_MEDIA_MAX_HEIGHT, 140);
  // Small iPhone content width; the cap must actually bind.
  assert.equal(resolveCardRenderedHeight(375 - 32), 140);
});

test('an Activity card now fits ~3 to a small screen', () => {
  const card = resolveCardRenderedHeight(375 - 32) + 80; // media + title/meta/capacity
  assert.ok(card * 3 < 700, `card is ${card}pt`);
});

test('My Activities reuses the shared card, with no separate image path', () => {
  const s = readFileSync(new URL('../screens/MyActivitiesScreen.tsx', import.meta.url), 'utf8');
  assert.match(s, /<ActivityCard/);
  assert.ok(!/CoverImage|aspectRatio|resizeMode/.test(s), 'My Activities hand-rolls image sizing');
});

test('detail heroes are bounded by screen height, not just aspect ratio', () => {
  for (const f of ['../screens/EventDetailsScreen.tsx', '../screens/PlaceDetailsScreen.tsx']) {
    const s = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.match(s, /maxHeight: HERO_MAX/, `${f} hero is unbounded`);
    assert.match(s, /resolveHeroMaxHeight/, `${f} does not use the shared cap`);
  }
});
