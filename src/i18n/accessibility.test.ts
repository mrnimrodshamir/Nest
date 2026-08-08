import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { translate } from './core.ts';
import { parentRoleKey } from '@/utils/parentRole';
import type { TranslationKey } from './en.ts';

function read(relative: string): string {
  return readFileSync(new URL(relative, import.meta.url), 'utf8');
}

const discover = read('../screens/DiscoverScreen.tsx');
const languageSelector = read('../components/LanguageSelector.tsx');
const editProfile = read('../screens/EditProfileScreen.tsx');

// --- Accessibility labels are localized, not hardcoded English -------------

test('every accessibilityLabel in Discovery comes from a translation call', () => {
  const labels = discover.match(/accessibilityLabel=\{[^}]*\}|accessibilityLabel="[^"]*"/g) ?? [];
  assert.ok(labels.length > 0, 'no accessibility labels found');
  for (const label of labels) {
    assert.ok(
      label.includes('t(') || label.includes('{label}') || label.includes('item.label'),
      `hardcoded accessibility label: ${label}`,
    );
  }
});

test('content-type checkboxes expose a checked state and a localized label', () => {
  assert.match(discover, /accessibilityRole="checkbox"/);
  assert.match(discover, /accessibilityState=\{\{ checked: selected \}\}/);
  assert.match(discover, /t\('filters\.showType'/);
});

test('sort options are radios with a checked state and a localized label', () => {
  assert.match(discover, /accessibilityRole="radio"/);
  assert.match(discover, /accessibilityState=\{\{ checked: sort === item\.key \}\}/);
  assert.match(discover, /accessibilityLabel=\{t\(item\.labelKey\)\}/);
});

test('retry actions announce WHAT failed, not just "try again"', () => {
  assert.match(discover, /t\('common\.retryLabel', \{ label \}\)/);
  for (const locale of ['en', 'he'] as const) {
    const rendered = translate(locale, 'common.retryLabel', { label: 'X' });
    assert.ok(rendered.includes('X'), `${locale} dropped the failing domain name`);
  }
});

test('the language selector is a radiogroup with per-option checked state', () => {
  assert.match(languageSelector, /accessibilityRole="radiogroup"/);
  assert.match(languageSelector, /accessibilityRole="radio"/);
  assert.match(languageSelector, /accessibilityState=\{\{ checked: selected \}\}/);
});

test('the parent-role selector exposes a localized label and selected state', () => {
  assert.match(editProfile, /accessibilityState=\{\{ selected \}\}/);
  assert.match(editProfile, /accessibilityLabel=\{t\(parentRoleKey\(option\)\)\}/);
});

// --- Touch targets ---------------------------------------------------------

test('interactive rows and chips declare a minimum height of at least 44', () => {
  for (const [name, source] of [['LanguageSelector', languageSelector], ['DiscoverScreen', discover]] as const) {
    const heights = [...source.matchAll(/minHeight:\s*(\d+)/g)].map((m) => Number(m[1]));
    assert.ok(heights.length > 0, `${name} declares no minHeight`);
    for (const height of heights) {
      assert.ok(height >= 44, `${name} has a ${height}pt target, below the 44pt minimum`);
    }
  }
});

// --- Hebrew labels ---------------------------------------------------------

const SPOKEN_KEYS: TranslationKey[] = [
  'discovery.search', 'discovery.filters', 'discovery.sort',
  'discovery.activities', 'discovery.places', 'discovery.events',
  'discovery.hostActivity', 'discovery.closeSearch', 'discovery.retry',
  'common.share', 'common.addToCalendar', 'common.editProfile',
  'language.title', 'filters.resetAll',
];

test('every spoken control label has a real Hebrew translation', () => {
  for (const key of SPOKEN_KEYS) {
    const hebrew = translate('he', key);
    assert.notEqual(hebrew, key, `${key} fell through to the raw key`);
    assert.notEqual(hebrew, translate('en', key), `${key} is still English in Hebrew`);
    assert.ok(/[֐-׿]/.test(hebrew), `${key} contains no Hebrew characters`);
  }
});

test('interpolated accessibility labels stay correct in Hebrew', () => {
  const label = translate('he', 'filters.showType', { type: 'פעילויות' });
  assert.ok(label.includes('פעילויות'));
  assert.ok(!label.includes('{type}'), 'placeholder was not substituted');
});

test('every parent role resolves to a distinct Hebrew label', () => {
  const labels = (['mom', 'dad', 'parent'] as const).map((role) => translate('he', parentRoleKey(role)));
  assert.equal(new Set(labels).size, 3, 'two roles render identically in Hebrew');
  for (const label of labels) assert.ok(/[֐-׿]/.test(label), label);
});

test('an unset role speaks as the neutral "Parent" in both languages', () => {
  assert.equal(translate('en', parentRoleKey(null)), 'Parent');
  assert.equal(translate('he', parentRoleKey(null)), 'הורה');
});
