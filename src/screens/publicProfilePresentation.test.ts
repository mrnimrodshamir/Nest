import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildPublicChildren } from '@/utils/publicFamilyProfile';
import { textAlignForContent } from '@/i18n/rtl';

const screen = readFileSync(new URL('./PublicProfileScreen.tsx', import.meta.url), 'utf8');
const hook = readFileSync(new URL('../hooks/usePublicProfile.ts', import.meta.url), 'utf8');

// ===========================================================================
// PRIVACY — what must never reach this screen
// ===========================================================================

test('PRIVACY: the public profile query selects no private field', () => {
  const code = hook.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const forbidden of ['birthdate', 'phone', 'latitude', 'longitude', 'formatted_address', 'location']) {
    assert.ok(
      !new RegExp(`['\`,\\s]${forbidden}\\b`).test(code),
      `${forbidden} is selected for a public profile`,
    );
  }
  // Age arrives pre-derived; the date it came from stays in the private row.
  assert.match(hook, /age_years/);
});

test('PRIVACY: child ages are coarse, and no birthdate can be passed in', () => {
  // buildPublicChildren accepts names and months only — there is no parameter
  // a birthdate could travel through.
  assert.equal(buildPublicChildren.length, 2);
  const children = buildPublicChildren(['Go', 'Yo'], [1, 30]);
  assert.equal(children[0].ageKey, 'profile.childAge.month.one');
  assert.equal(children[1].ageKey, 'profile.childAge.year.other');
  assert.ok(!/\d{4}-\d{2}-\d{2}/.test(JSON.stringify(children)), 'a date leaked');
});

// ===========================================================================
// MISSING FIELDS DISAPPEAR
// ===========================================================================

test('every optional section is conditionally rendered, never a blank row', () => {
  for (const guard of [
    /\{children\.length \?/,
    /\{profile\.occupation\?\.trim\(\) \?/,
    /\{profile\.bio\?\.trim\(\) \?/,
    /\{profile\.sharedActivityTitle \?/,
  ]) {
    assert.match(screen, guard);
  }
});

test('an unknown age shows the name alone rather than an empty age slot', () => {
  const [child] = buildPublicChildren(['Go'], [null]);
  assert.equal(child.ageKey, null);
  assert.match(screen, /child\.ageKey \? \(/);
});

test('a missing parent age leaves the name unadorned, with no stray comma', () => {
  assert.match(screen, /profile\.ageYears === null \? profile\.displayName : `\$\{profile\.displayName\}, \$\{profile\.ageYears\}`/);
});

// ===========================================================================
// DIRECTION — user text follows its own script, app copy follows the UI
// ===========================================================================

test('REGRESSION: user-written text is aligned by CONTENT, not by UI locale', () => {
  // Aligning a bio by isRTL meant a French bio rendered right-aligned to a
  // Hebrew viewer, and a Hebrew name left-aligned to an English one.
  assert.match(screen, /textAlignForContent\(profile\.bio, locale\)/);
  assert.match(screen, /textAlignForContent\(profile\.occupation, locale\)/);
  assert.match(screen, /textAlignForContent\(child\.name, locale\)/);
  const code = screen.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/isRTL && styles\.rtlText/.test(code), 'locale-based text alignment is back');
});

test('content alignment is genuinely script-driven in all four languages', () => {
  // Hebrew content stays right-aligned even for an English reader.
  assert.equal(textAlignForContent('שלום', 'en').textAlign, 'right');
  // Latin and Cyrillic content stays left-aligned even for a Hebrew reader.
  assert.equal(textAlignForContent('Bonjour', 'he').textAlign, 'left');
  assert.equal(textAlignForContent('Привет', 'he').textAlign, 'left');
  // Direction-neutral text falls back to the UI locale.
  assert.equal(textAlignForContent('123', 'he').textAlign, 'right');
  assert.equal(textAlignForContent('123', 'fr').textAlign, 'left');
});

test('the back arrow still flips with the UI, since it is a directional icon', () => {
  assert.match(screen, /isRTL \? styles\.flipped : undefined/);
});

// ===========================================================================
// SMALL IPHONE
// ===========================================================================

test('a long localized age cannot wrap and break the child row', () => {
  // "11 месяцев" and "2 ans et demi" are materially longer than "11 months".
  assert.match(screen, /styles\.childAge\} numberOfLines=\{1\}/);
  assert.match(screen, /childRow: \{ minHeight: 44/);
});
