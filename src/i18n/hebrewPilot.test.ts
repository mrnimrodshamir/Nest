import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { activityCategoryLabel, localizedPlaceArea, placeCategoryLabel } from './taxonomy.ts';
import { setActiveDateLocale, translate } from './core.ts';
import { textAlignForContent } from './rtl.ts';
import { formatParentSubtitle } from '@/utils/formatParentSubtitle.ts';
import { formatExactStartTime } from '@/utils/formatExactStartTime.ts';
import { formatPlaceDistance, placeSummaryFeatures } from '@/utils/familyFriendlyPlace.ts';
import type { FamilyFriendlyPlace } from '@/types/familyFriendlyPlace';

const he = (key: Parameters<typeof translate>[1], params?: Parameters<typeof translate>[2]) => translate('he', key, params);

test('Build 38: Hebrew caregiver subtitle uses the stored role and every child', () => {
  const result = formatParentSubtitle([{ name: 'Go' }, { name: 'Yo' }, { name: 'Zo' }], 'dad', he);
  assert.match(result ?? '', /^אבא של/);
  assert.match(result ?? '', /ועוד 1/);
  assert.doesNotMatch(result ?? '', /Parent of/);
});

test('Build 38: Hebrew notification labels contain no English fallback', () => {
  assert.equal(he('profile.notification.activityChanges'), 'עדכונים על פעילויות');
  assert.equal(he('profile.notification.chatMessages'), 'הודעות חדשות');
  assert.equal(he('profile.notification.reminders'), 'תזכורות לפני פעילויות');
});

test('Build 38: NestUp place taxonomy, area, features and distance localize', () => {
  assert.equal(placeCategoryLabel('library', he), 'ספרייה');
  assert.equal(placeCategoryLabel('museum', he), 'מוזיאון');
  assert.equal(localizedPlaceArea('City Center', he), 'מרכז העיר');
  assert.equal(formatPlaceDistance(970, he), '970 מ׳ מכאן');
  const place = { shade: true, toilets: true, strollerFriendly: false, changingTable: true, highChairs: false, accessible: false, waterFountain: false } as FamilyFriendlyPlace;
  assert.deepEqual(placeSummaryFeatures(place, 3, he), ['צל', 'שירותים', 'עמדת החתלה']);
});

test('Build 38: Hebrew activity metadata uses localized taxonomy and connectors', () => {
  setActiveDateLocale('he');
  assert.equal(activityCategoryLabel('coffee_meetup', he), 'מפגש קפה');
  const now = new Date('2026-08-16T16:00:00Z');
  const label = formatExactStartTime('2026-08-16T17:00:00Z', now);
  assert.match(label, /^היום ב־/);
  assert.doesNotMatch(label, /Today| at |In /);
  setActiveDateLocale('en');
});

test('Build 38: user-generated text follows its own script in Hebrew UI', () => {
  assert.deepEqual(textAlignForContent('Nimrod Shamir: I really like this', 'he'), { textAlign: 'left', writingDirection: 'ltr' });
  assert.deepEqual(textAlignForContent('נמרוד: ממש אהבתי', 'he'), { textAlign: 'right', writingDirection: 'rtl' });
});

test('Build 38: rendered Place and Profile paths no longer hardcode reported English labels', () => {
  const placeCard = readFileSync(new URL('../components/PlaceCard.tsx', import.meta.url), 'utf8');
  const profile = readFileSync(new URL('../screens/ProfileScreen.tsx', import.meta.url), 'utf8');
  for (const label of ['Indoor', 'Outdoor', 'Paid', 'Changing table', 'City Center']) {
    assert.doesNotMatch(placeCard, new RegExp(`['\"]${label}['\"]`));
  }
  for (const label of ['Activity updates', 'New messages', 'Reminders before activities']) {
    assert.doesNotMatch(profile, new RegExp(label));
  }
});
