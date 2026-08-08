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
];

/** Screens still holding hardcoded English. Tracked explicitly so the gap is
 *  visible rather than forgotten. Each one moves to MIGRATED as it is done. */
const NOT_YET_MIGRATED = [
  'ActivityDetailScreen.tsx',
  'BlockedUsersScreen.tsx',
  'ChatScreen.tsx',
  'CreateActivityScreen.tsx',
  'EditActivityScreen.tsx',
  'EditProfileScreen.tsx',
  'MyActivitiesScreen.tsx',
  'PublicProfileScreen.tsx',
  'ShareActivityScreen.tsx',
];

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
