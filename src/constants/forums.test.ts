import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FORUMS, FORUM_KEYS, forumDefinition, forumDeepLink, isForumKey } from './forums.ts';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import { translate } from '@/i18n/core';
import { parseSharedContentUrl } from '@/utils/contentSharing';

// --- The fixed set ---------------------------------------------------------

test('exactly the twelve approved forums are defined', () => {
  assert.equal(FORUMS.length, 12);
  assert.equal(FORUM_KEYS.length, 12);
});

test('the two late additions are present', () => {
  for (const key of ['first-time-parents', 'daycare-preschools']) {
    assert.ok(forumDefinition(key), `${key} is missing`);
  }
});

test('exactly the three approved forums are pinned', () => {
  const pinned = FORUMS.filter((f) => f.pinned).map((f) => f.key);
  assert.deepEqual(pinned.sort(), ['local-recommendations', 'parental-leave', 'things-to-do-tel-aviv']);
});

test('forum keys are unique and URL-safe', () => {
  assert.equal(new Set(FORUM_KEYS).size, 12, 'duplicate key');
  for (const key of FORUM_KEYS) {
    assert.match(key, /^[a-z0-9-]+$/, `${key} is not a safe slug`);
    assert.equal(encodeURIComponent(key), key, `${key} needs escaping`);
  }
});

test('sort order is unique and strictly increasing in declaration order', () => {
  const orders = FORUMS.map((f) => f.sortOrder);
  assert.equal(new Set(orders).size, orders.length, 'duplicate sortOrder');
  assert.deepEqual(orders, [...orders].sort((a, b) => a - b), 'declaration order disagrees with sortOrder');
});

test('every forum declares an icon', () => {
  for (const forum of FORUMS) assert.ok(forum.icon.length > 0, forum.key);
});

test('the catalogue is frozen, so no runtime code can add a forum', () => {
  assert.ok(Object.isFrozen(FORUMS));
  assert.throws(() => {
    (FORUMS as unknown as unknown[]).push({});
  });
});

// --- Key guard -------------------------------------------------------------

test('isForumKey accepts known keys and rejects everything else', () => {
  assert.equal(isForumKey('breastfeeding'), true);
  for (const bad of ['', 'nope', 'Breastfeeding', null, undefined, 42, {}]) {
    assert.equal(isForumKey(bad), false, String(bad));
  }
});

test('an unknown key resolves to null rather than a partial definition', () => {
  assert.equal(forumDefinition('not-a-forum'), null);
});

// --- Deep links ------------------------------------------------------------

test('every forum produces a stable nestup://forum/<key> link', () => {
  for (const forum of FORUMS) {
    assert.equal(forumDeepLink(forum.key), `nestup://forum/${forum.key}`);
  }
});

test('a forum link routes to the forum chat, never to Activity/Place/Event', () => {
  for (const forum of FORUMS) {
    assert.deepEqual(
      parseSharedContentUrl(forumDeepLink(forum.key)),
      { screen: 'Chat', params: { kind: 'forum', forumKey: forum.key } },
      forum.key,
    );
  }
});

test('REGRESSION: activity, place and event links are unaffected by the forum route', () => {
  assert.deepEqual(parseSharedContentUrl('nestup://activity/a1'), { screen: 'ActivityDetail', params: { activityId: 'a1' } });
  assert.deepEqual(parseSharedContentUrl('nestup://place/p1'), { screen: 'PlaceDetails', params: { placeId: 'p1' } });
  assert.deepEqual(parseSharedContentUrl('nestup://event/e1'), { screen: 'EventDetails', params: { occurrenceId: 'e1' } });
  // Legacy links still resolve, including for forums.
  assert.deepEqual(parseSharedContentUrl('momzi://activity/a1'), { screen: 'ActivityDetail', params: { activityId: 'a1' } });
});

test('a malformed or unknown forum link is rejected, not routed', () => {
  for (const bad of ['nestup://forum/', 'nestup://forum', 'nestup://forums/x', 'https://example.com/forum/x']) {
    assert.equal(parseSharedContentUrl(bad), null, bad);
  }
  // A syntactically valid but unknown key parses; the navigator drops it via
  // isForumKey rather than opening an empty chat.
  const unknown = parseSharedContentUrl('nestup://forum/not-a-forum');
  assert.deepEqual(unknown, { screen: 'Chat', params: { kind: 'forum', forumKey: 'not-a-forum' } });
  assert.equal(isForumKey('not-a-forum'), false);
});

// --- Localization ----------------------------------------------------------

for (const locale of ['en', 'he'] as const) {
  test(`every forum has a ${locale} title and description`, () => {
    for (const forum of FORUMS) {
      const title = translate(locale, forum.titleKey);
      const description = translate(locale, forum.descriptionKey);
      assert.notEqual(title, forum.titleKey, `${forum.key} title fell through to the key`);
      assert.notEqual(description, forum.descriptionKey, `${forum.key} description fell through`);
      assert.ok(title.trim().length > 0 && description.trim().length > 0, forum.key);
    }
  });

  test(`${locale} forum titles are all distinct`, () => {
    const titles = FORUMS.map((f) => translate(locale, f.titleKey));
    assert.equal(new Set(titles).size, titles.length, `two forums share a ${locale} title`);
  });

  test(`${locale} descriptions are one concise line`, () => {
    for (const forum of FORUMS) {
      const description = translate(locale, forum.descriptionKey);
      assert.ok(!description.includes('\n'), `${forum.key} description wraps lines`);
      // Long enough to be useful, short enough for a compact row.
      assert.ok(description.length <= 80, `${forum.key} description is ${description.length} chars`);
      assert.ok(description.length >= 12, forum.key);
    }
  });

  test(`${locale} descriptions are all distinct`, () => {
    const descriptions = FORUMS.map((f) => translate(locale, f.descriptionKey));
    assert.equal(new Set(descriptions).size, descriptions.length, `two forums share a ${locale} description`);
  });
}

test('Hebrew forum names are actually Hebrew, not copied English', () => {
  for (const forum of FORUMS) {
    const hebrew = translate('he', forum.titleKey);
    assert.notEqual(hebrew, translate('en', forum.titleKey), `${forum.key} is untranslated`);
    assert.ok(/[֐-׿]/.test(hebrew), `${forum.key} has no Hebrew characters`);
  }
});

test('the approved Hebrew names are used verbatim', () => {
  const expected: Record<string, string> = {
    'tel-aviv-moms': 'אמהות תל אביב',
    'tel-aviv-dads': 'אבות תל אביב',
    breastfeeding: 'הנקה',
    'child-development': 'התפתחות הילד',
    'parental-leave': 'הורים בחופשת לידה',
    'baby-sleep': 'שינת תינוקות',
    'things-to-do-tel-aviv': 'פעילויות עם ילדים בתל אביב',
    'local-recommendations': 'המלצות מקומיות',
    'pregnancy-postpartum': 'הריון ואחרי לידה',
    'first-time-parents': 'לידה ראשונה',
    'daycare-preschools': 'מסגרות וגנים',
  };
  for (const [key, hebrew] of Object.entries(expected)) {
    const definition = forumDefinition(key);
    assert.ok(definition, key);
    assert.equal(translate('he', definition.titleKey), hebrew, key);
  }
});

// --- Client / migration agreement -----------------------------------------

const seed = readFileSync(new URL('../../supabase/migrations/0013_community_forums_seed.sql', import.meta.url), 'utf8');

test('the migration seeds exactly the keys the client knows about', () => {
  for (const key of FORUM_KEYS) {
    assert.ok(seed.includes(`'${key}'`), `${key} is missing from the seed migration`);
  }
  const seeded = [...seed.matchAll(/\(\s*'([a-z0-9-]+)',\s*'/g)].map((m) => m[1]);
  assert.deepEqual([...seeded].sort(), [...FORUM_KEYS].sort(), 'seed and client catalogue disagree');
});

test('client and migration agree on every icon and sort order', () => {
  for (const forum of FORUMS) {
    const row = seed.split('\n').find((line) => line.includes(`('${forum.key}'`));
    assert.ok(row, forum.key);
    assert.ok(row.includes(`'${forum.icon}'`), `${forum.key} icon differs from the seed`);
    assert.ok(new RegExp(`\\b${forum.sortOrder}\\)`).test(row), `${forum.key} sortOrder differs from the seed`);
  }
});

test('the seed is re-runnable and never creates a duplicate chat', () => {
  assert.match(seed, /if exists \(select 1 from public\.forums f where f\.key = seed\.key\) then/);
  assert.match(seed, /continue;/);
});

test('no migration grants clients the right to create or rename a forum', () => {
  const table = readFileSync(new URL('../../supabase/migrations/0012_community_forums.sql', import.meta.url), 'utf8');
  assert.match(table, /for select to authenticated/);
  assert.ok(!/for (insert|update|delete)/i.test(table), 'a write policy was added to forums');
});
