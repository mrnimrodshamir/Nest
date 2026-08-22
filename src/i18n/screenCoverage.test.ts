import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { en } from './en.ts';
import { he } from './he.ts';
import { translate, missingKeys } from './core.ts';

const SCREEN_DIR = new URL('../screens/', import.meta.url);

/** Screens fully migrated to translation keys. Adding a screen here without
 *  actually migrating it fails the test below, and finishing a migration
 *  without adding it here fails too — so this list cannot drift from reality. */
const MIGRATED = [
  'DiscoverScreen.tsx',
  'ProfileScreen.tsx',
  'MessagesScreen.tsx',
  'PlaceDetailsScreen.tsx',
  'EventDetailsScreen.tsx',
  'MyActivitiesScreen.tsx',
  'BlockedUsersScreen.tsx',
  'PublicProfileScreen.tsx',
  'ActivityDetailScreen.tsx',
  'ChatScreen.tsx',
  'CreateActivityScreen.tsx',
  'EditActivityScreen.tsx',
  'EditProfileScreen.tsx',
  'ShareActivityScreen.tsx',
  'DailyDigestScreen.tsx',
  'WeeklyDigestScreen.tsx',
  'WeekendDigestScreen.tsx',
];

/** Screens still holding hardcoded English. Empty — every screen with
 *  user-visible copy now resolves it through i18n. */
const NOT_YET_MIGRATED: string[] = [];

/** No user-visible copy at all, so nothing to translate. */
const NO_COPY = ['LaunchScreen.tsx'];

function read(name: string): string {
  return readFileSync(new URL(name, SCREEN_DIR), 'utf8');
}

test('the migration ledger accounts for every screen — none silently missed', () => {
  const actual = readdirSync(SCREEN_DIR).filter((f) => f.endsWith('.tsx')).sort();
  const tracked = [...MIGRATED, ...NOT_YET_MIGRATED, ...NO_COPY].sort();
  assert.deepEqual(actual, tracked, 'a screen was added or renamed without updating this ledger');
});

test('no screen is listed as both migrated and pending', () => {
  const overlap = MIGRATED.filter((s) => NOT_YET_MIGRATED.includes(s));
  assert.deepEqual(overlap, []);
});

for (const screen of MIGRATED) {
  test(`${screen} resolves its copy through i18n`, () => {
    const source = read(screen);
    assert.match(source, /useI18n|useTranslation/, `${screen} does not use the i18n hook`);
    assert.match(source, /\bt\(['"]/, `${screen} has no translate calls`);
  });

  test(`${screen} uses only keys that exist in the English dictionary`, () => {
    const source = read(screen);
    const used = [...source.matchAll(/\bt\(\s*'([a-zA-Z0-9._-]+)'/g)].map((m) => m[1]);
    assert.ok(used.length > 0, `${screen} has no keys to check`);
    for (const key of used) {
      assert.ok(key in en, `${screen} uses unknown key "${key}"`);
    }
  });

  test(`${screen} renders no raw key in either language`, () => {
    const source = read(screen);
    const used = [...source.matchAll(/\bt\(\s*'([a-zA-Z0-9._-]+)'/g)].map((m) => m[1]);
    for (const key of used) {
      for (const locale of ['en', 'he'] as const) {
        const value = translate(locale, key as keyof typeof en);
        assert.notEqual(value, key, `${screen}: "${key}" falls through to the raw key in ${locale}`);
      }
    }
  });
}

test('every English key has a Hebrew translation — the dictionaries stay in step', () => {
  assert.deepEqual(missingKeys('he'), []);
  assert.deepEqual(missingKeys('en'), []);
});

test('Hebrew introduces no key English lacks', () => {
  const englishKeys = new Set(Object.keys(en));
  assert.deepEqual(Object.keys(he).filter((k) => !englishKeys.has(k)), []);
});

test('ENCODING: no dictionary value contains mojibake', () => {
  // A UTF-8 file read back through a legacy codepage and rewritten produces
  // sequences like "ג€”" for an em dash or "׳©׳₪׳”" for Hebrew. TypeScript still
  // compiles and every other test still passes, so nothing else catches it.
  // (This guard exists because exactly that happened during development.)
  const MOJIBAKE = /ג€|נ‘|Ã[-¿]|â€|Ð/;
  for (const [key, value] of Object.entries({ ...en, ...he })) {
    assert.ok(!MOJIBAKE.test(String(value)), `${key} looks double-encoded: ${value}`);
  }
});

test('ENCODING: Hebrew values are actually Hebrew codepoints', () => {
  // Real Hebrew lives in U+0590-U+05FF. Double-encoded Hebrew lands in
  // Latin-1 supplement instead, so this fails loudly if the file is mangled.
  const hebrewEntries = Object.entries(he).filter(([key]) => !key.startsWith('language.'));
  const withHebrew = hebrewEntries.filter(([, v]) => /[֐-׿]/.test(String(v)));
  assert.ok(withHebrew.length > 50, `only ${withHebrew.length} Hebrew values found — the file may be corrupted`);
});

test('no dictionary value is an empty or whitespace-only string', () => {
  for (const [key, value] of Object.entries({ ...en, ...he })) {
    assert.ok(String(value).trim().length > 0, `${key} is blank`);
  }
});

test('every placeholder in an English string also appears in the Hebrew one', () => {
  const placeholders = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort();
  for (const key of Object.keys(en) as Array<keyof typeof en>) {
    const hebrew = he[key];
    if (!hebrew) continue;
    assert.deepEqual(
      placeholders(hebrew),
      placeholders(en[key]),
      `${key}: Hebrew and English placeholders differ, so one language would render a literal {token}`,
    );
  }
});

test('PROGRESS: at least the core content surfaces are migrated', () => {
  // Discovery, Chats, Profile, Place and Event details are the surfaces a
  // beta tester spends nearly all their time in.
  for (const screen of ['DiscoverScreen.tsx', 'MessagesScreen.tsx', 'ProfileScreen.tsx', 'PlaceDetailsScreen.tsx', 'EventDetailsScreen.tsx']) {
    assert.ok(MIGRATED.includes(screen), `${screen} should be migrated`);
  }
});
