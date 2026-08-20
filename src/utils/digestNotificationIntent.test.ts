import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DigestNotificationIntentController,
  digestRoutesAreRegistered,
} from './digestNotificationIntent.ts';

const NOW = new Date('2026-08-20T12:00:00.000Z');
const daily = {
  kind: 'daily_digest',
  type: 'daily_digest',
  date: '2026-08-20',
  city: 'tel_aviv',
  occurrence_ids: ['event-occ-v1-a', 'event-occ-v1-b'],
};
const weekly = {
  kind: 'weekly_digest',
  type: 'weekly_digest',
  week_start: '2026-08-23',
  city: 'tel_aviv',
  occurrence_ids: ['event-occ-v1-c'],
};

test('Daily cold-start intent survives until the registered main stack consumes it', () => {
  const controller = new DigestNotificationIntentController();
  assert.equal(controller.capture(daily, 'daily-1', NOW), 'queued');
  const pending = controller.peek();
  assert.deepEqual(pending, {
    kind: 'daily',
    date: '2026-08-20',
    occurrenceIds: ['event-occ-v1-a', 'event-occ-v1-b'],
  });
  assert.equal(digestRoutesAreRegistered(['SignIn', 'CompleteProfile']), false);
  assert.equal(controller.peek(), pending, 'auth restoration must not consume the intent');
  assert.equal(digestRoutesAreRegistered(['Tabs', 'DailyDigest', 'WeeklyDigest']), true);
  assert.equal(controller.consume(pending!), true);
  assert.equal(controller.peek(), null);
});

test('Weekly warm-start intent queues and is consumed exactly once', () => {
  const controller = new DigestNotificationIntentController();
  assert.equal(controller.capture(weekly, 'weekly-1', NOW), 'queued');
  const pending = controller.peek();
  assert.equal(controller.consume(pending!), true);
  assert.equal(controller.consume(pending!), false);
  assert.equal(controller.capture(weekly, 'weekly-1', NOW), 'duplicate');
  assert.equal(controller.peek(), null);
});

test('duplicate cold and warm callbacks produce one modal intent', () => {
  const controller = new DigestNotificationIntentController();
  assert.equal(controller.capture(daily, 'same-native-request', NOW), 'queued');
  assert.equal(controller.capture(daily, 'same-native-request', NOW), 'duplicate');
  assert.equal(controller.peek()?.kind, 'daily');
});

test('malformed and stale Digest payloads queue safe fallback while normal pushes do not', () => {
  const malformed = new DigestNotificationIntentController();
  assert.equal(malformed.capture({ kind: 'daily_digest' }, 'bad', NOW), 'queued');
  assert.deepEqual(malformed.peek(), { kind: 'fallback' });

  const stale = new DigestNotificationIntentController();
  assert.equal(stale.capture({ ...daily, date: '2026-08-19' }, 'stale', NOW), 'queued');
  assert.deepEqual(stale.peek(), { kind: 'fallback' });

  const ordinary = new DigestNotificationIntentController();
  assert.equal(ordinary.capture({ kind: 'chat' }, 'chat', NOW), 'not_digest');
  assert.equal(ordinary.peek(), null, 'normal app activity never invents a Digest popup');
});

test('payload occurrence IDs are optional for backwards compatibility and malformed arrays fail closed', () => {
  const legacy = new DigestNotificationIntentController();
  assert.equal(legacy.capture({ ...daily, occurrence_ids: undefined }, 'legacy', NOW), 'queued');
  assert.deepEqual(legacy.peek(), { kind: 'daily', date: '2026-08-20', occurrenceIds: [] });

  const malformed = new DigestNotificationIntentController();
  assert.equal(malformed.capture({ ...daily, occurrence_ids: ['ok', 4] }, 'bad-ids', NOW), 'queued');
  assert.deepEqual(malformed.peek(), { kind: 'fallback' });
});
