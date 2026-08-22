import test from 'node:test';
import assert from 'node:assert/strict';
import { mapNotificationPreferences } from './notificationPreferences.ts';

for (const [daily, weekly] of [[true, false], [false, true], [true, true], [false, false]] as const) {
  test(`Daily ${daily ? 'ON' : 'OFF'} / Weekly ${weekly ? 'ON' : 'OFF'} remain independent`, () => {
    const mapped = mapNotificationPreferences({ daily_digest: daily, weekly_digest: weekly });
    assert.equal(mapped.daily_digest, daily);
    assert.equal(mapped.weekly_digest, weekly);
  });
}

test('missing digest preferences default off', () => {
  const mapped = mapNotificationPreferences(null);
  assert.equal(mapped.daily_digest, false);
  assert.equal(mapped.weekly_digest, false);
  assert.equal(mapped.weekend_digest, false);
});

test('Weekend remains independent from Daily and Weekly', () => {
  const mapped = mapNotificationPreferences({ daily_digest: true, weekly_digest: false, weekend_digest: true });
  assert.equal(mapped.daily_digest, true);
  assert.equal(mapped.weekly_digest, false);
  assert.equal(mapped.weekend_digest, true);
});
