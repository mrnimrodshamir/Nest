import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SUPPORTED_LOCALES, setActiveDateLocale } from './core.ts';
import { formatDuration } from '@/utils/formatDuration.ts';
import { formatExactStartTime } from '@/utils/formatExactStartTime.ts';
import { generateActivityTitle } from '@/utils/generateActivityTitle.ts';
import { formatChatSystemMessage } from '@/utils/formatChatSystemMessage.ts';

test('duration formatting is natural in Hebrew and English', () => {
  setActiveDateLocale('he');
  assert.deepEqual([0, 30, 45, 60, 90, 120, 150].map(formatDuration), [
    '0 דקות', '30 דקות', '45 דקות', 'שעה', 'שעה וחצי', 'שעתיים', 'שעתיים ו־30 דקות',
  ]);
  setActiveDateLocale('en');
  assert.deepEqual([30, 60, 90, 120].map(formatDuration), ['30 min', '1 hour', '1.5 hours', '2 hours']);
});

test('exact dates use the selected app locale and full natural names', () => {
  const now = new Date('2026-08-16T10:00:00+03:00');
  const start = '2026-08-19T20:00:00+03:00';
  setActiveDateLocale('he');
  const hebrew = formatExactStartTime(start, now);
  assert.match(hebrew, /יום רביעי/);
  assert.match(hebrew, /באוגוסט/);
  assert.doesNotMatch(hebrew, /Wednesday|August| at /);
  setActiveDateLocale('en');
  assert.match(formatExactStartTime(start, now), /Wednesday, August 19 at 8:00 PM/);
});

test('a dropped pin contributes NO location to a generated title, in any language', () => {
  const now = new Date('2026-08-16T10:00:00+03:00');
  const tomorrow = new Date('2026-08-17T20:00:00+03:00');

  // Previously the stored English placeholder was interpolated verbatim, so a
  // Hebrew device showed "טיול עגלות ב־Meeting point". Translating the
  // placeholder would only have moved the problem: "at the meeting point" is
  // filler in every language. A pin with no name now yields no location clause.
  setActiveDateLocale('he');
  assert.equal(generateActivityTitle('stroller_walk', tomorrow, 'Meeting point', now), 'טיול עגלות מחר');
  setActiveDateLocale('en');
  assert.equal(generateActivityTitle('stroller_walk', tomorrow, 'Meeting point', now), 'Stroller walk tomorrow');

  // Legacy rows and empty names take the same path.
  for (const stored of ['', '  ', 'meeting point', ' Meeting Point ']) {
    setActiveDateLocale('he');
    assert.equal(generateActivityTitle('stroller_walk', tomorrow, stored, now), 'טיול עגלות מחר', stored);
  }

  // A real place name is still used, and still localized.
  setActiveDateLocale('he');
  assert.equal(generateActivityTitle('stroller_walk', tomorrow, 'Gordon Pool', now), 'טיול עגלות מחר ב־בריכת גורדון');
});

test('the storage placeholder can never reach the screen in ANY supported language', () => {
  const now = new Date('2026-08-16T10:00:00+03:00');
  const tomorrow = new Date('2026-08-17T20:00:00+03:00');
  for (const locale of SUPPORTED_LOCALES) {
    setActiveDateLocale(locale);
    const title = generateActivityTitle('stroller_walk', tomorrow, 'Meeting point', now);
    assert.doesNotMatch(title, /meeting point/i, `${locale} leaked the storage placeholder into a title`);
  }
  setActiveDateLocale('en');
});

test('structured chat events localize without touching user-authored content', () => {
  const metadata = { event: 'participant_joined', actor_name: 'Daniel', child_names: ['Maya', 'Noa'] };
  assert.equal(formatChatSystemMessage(metadata, 'en'), 'Daniel joined with Maya and Noa');
  assert.equal(formatChatSystemMessage(metadata, 'he'), 'Daniel הצטרפו עם Maya ו-Noa');
  const userMessage = 'See you at 18:00 ליד הפארק';
  assert.equal(userMessage, 'See you at 18:00 ליד הפארק');
});

test('reported raw Hebrew-mode English UI literals no longer bypass i18n', () => {
  const files = [
    '../components/ActivityForm.tsx', '../components/ContentImageGallery.tsx',
    '../screens/ActivityDetailScreen.tsx', '../navigation/AuthNavigator.tsx',
  ];
  const source = files.map((file) => readFileSync(new URL(file, import.meta.url), 'utf8')).join('\n');
  for (const copy of ['Give your activity a title', 'Name the public place you picked', '>Gallery<', 'km away', "Couldn't sign in"]) {
    assert.doesNotMatch(source, new RegExp(copy.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('primary stack screens mirror their navigation arrow in RTL', () => {
  const files = [
    '../screens/ActivityDetailScreen.tsx', '../screens/CreateActivityScreen.tsx',
    '../screens/EditActivityScreen.tsx', '../screens/EditProfileScreen.tsx',
    '../screens/MyActivitiesScreen.tsx', '../screens/BlockedUsersScreen.tsx',
  ];
  for (const file of files) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    assert.match(source, /isRTL \? styles\.flipped : undefined/, `${file} must mirror its back arrow`);
    assert.match(source, /scaleX: -1/, `${file} must define the RTL mirror transform`);
  }
});
