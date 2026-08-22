import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDigestPushMessage, buildDailyDigestDeepLink, buildWeeklyDigestDeepLink, buildWeeklyDigestPushMessage, buildWeekendDigestDeepLink, buildWeekendDigestPushMessage } from './pushPayload.ts';

test('the push message carries the persisted Digest selection and stable deep-link fields', () => {
  const message = buildDigestPushMessage({
    expoPushToken: 'ExponentPushToken[abc]',
    locale: 'he',
    localDate: '2026-08-20',
    eventCount: 2,
    occurrenceIds: ['event-occ-v1-a', 'event-occ-v1-b'],
  });
  assert.deepEqual(message.data, {
    kind: 'daily_digest',
    type: 'daily_digest',
    date: '2026-08-20',
    occurrence_ids: ['event-occ-v1-a', 'event-occ-v1-b'],
    city: 'tel_aviv',
  });
});

test('no sensitive data appears anywhere in the built message', () => {
  const message = buildDigestPushMessage({ expoPushToken: 'ExponentPushToken[abc]', locale: 'ru', localDate: '2026-08-20', eventCount: 3 });
  const serialized = JSON.stringify(message);
  for (const forbidden of ['email', 'birthdate', 'latitude', 'longitude', 'access_token', 'refresh_token', 'child']) {
    assert.doesNotMatch(serialized, new RegExp(forbidden, 'i'), forbidden);
  }
});

test('title/body come from the locale-specific push copy, matching buildDigestPushCopy', () => {
  const message = buildDigestPushMessage({ expoPushToken: 't', locale: 'fr', localDate: '2026-08-20', eventCount: 5 });
  assert.match(message.title, /Tel Aviv/);
  assert.match(message.body, /5/);
});

test('the deep link contains type, date and city, and no user-identifying data', () => {
  const url = buildDailyDigestDeepLink('2026-08-20');
  assert.equal(url, 'nestup://daily-digest?type=daily_digest&date=2026-08-20&city=tel_aviv');
  assert.doesNotMatch(url, /user|token|email/i);
});

test('Weekly payload and deep link use only week_start and public routing fields', () => {
  const message = buildWeeklyDigestPushMessage({ expoPushToken: 't', locale: 'ar', weekStart: '2026-08-23', eventCount: 14 });
  assert.deepEqual(message.data, { kind: 'weekly_digest', type: 'weekly_digest', week_start: '2026-08-23', occurrence_ids: [], city: 'tel_aviv' });
  assert.equal(buildWeeklyDigestDeepLink('2026-08-23'), 'nestup://weekly-digest?type=weekly_digest&week_start=2026-08-23&city=tel_aviv');
});

test('Weekend payload contains only minimum routing identity', () => {
  const message = buildWeekendDigestPushMessage({ expoPushToken: 't', locale: 'he', weekendStart: '2026-08-27', eventCount: 6, occurrenceIds: ['o1'] });
  assert.deepEqual(message.data, { kind: 'weekend_digest', type: 'weekend_digest', weekend_local_date: '2026-08-27', occurrence_ids: ['o1'], city: 'tel_aviv' });
  assert.equal(buildWeekendDigestDeepLink('2026-08-27'), 'nestup://weekend-digest?type=weekend_digest&weekend_local_date=2026-08-27&city=tel_aviv');
  assert.doesNotMatch(JSON.stringify(message.data), /user|token|email|child|latitude|longitude/i);
});
