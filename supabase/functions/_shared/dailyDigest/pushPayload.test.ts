import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDigestPushMessage, buildDailyDigestDeepLink } from './pushPayload.ts';

test('the push message data payload carries only the stable deep-link fields', () => {
  const message = buildDigestPushMessage({ expoPushToken: 'ExponentPushToken[abc]', locale: 'he', localDate: '2026-08-20', eventCount: 4 });
  assert.deepEqual(message.data, { kind: 'daily_digest', type: 'daily_digest', date: '2026-08-20', city: 'tel_aviv' });
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
