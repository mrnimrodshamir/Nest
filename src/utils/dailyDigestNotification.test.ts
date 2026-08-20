import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDailyDigestNotification, parseDigestNotification } from './dailyDigestNotification.ts';

const NOW = new Date('2026-08-20T04:05:00Z');

test('validates the complete Daily Digest notification contract', () => {
  assert.deepEqual(parseDailyDigestNotification({ kind: 'daily_digest', type: 'daily_digest', date: '2026-08-20', city: 'tel_aviv' }, NOW), {
    status: 'valid', date: '2026-08-20', city: 'tel_aviv', occurrenceIds: [],
  });
});

test('missing/malformed dates and payload fields fail closed', () => {
  for (const data of [
    { kind: 'daily_digest' },
    { kind: 'daily_digest', type: 'daily_digest', date: '2026-02-30', city: 'tel_aviv' },
    { kind: 'daily_digest', type: 'wrong', date: '2026-08-20', city: 'tel_aviv' },
    { kind: 'daily_digest', type: 'daily_digest', date: '2026-08-20', city: 'other' },
  ]) assert.deepEqual(parseDailyDigestNotification(data, NOW), { status: 'malformed' });
});

test('a no-longer-current digest is stale and unrelated pushes are untouched', () => {
  assert.deepEqual(parseDailyDigestNotification({ kind: 'daily_digest', type: 'daily_digest', date: '2026-08-19', city: 'tel_aviv' }, NOW), { status: 'stale' });
  assert.deepEqual(parseDailyDigestNotification({ kind: 'chat' }, NOW), { status: 'not_digest' });
});

test('Weekly notification supports warm/cold routing and fails closed for malformed or stale weeks', () => {
  const saturday = new Date('2026-08-22T16:05:00Z');
  assert.deepEqual(parseDigestNotification({ kind: 'weekly_digest', type: 'weekly_digest', week_start: '2026-08-23', city: 'tel_aviv' }, saturday), {
    status: 'valid', digestType: 'weekly', weekStart: '2026-08-23', city: 'tel_aviv', occurrenceIds: [],
  });
  assert.deepEqual(parseDigestNotification({ kind: 'weekly_digest', type: 'weekly_digest', week_start: '2026-08-16', city: 'tel_aviv' }, saturday), { status: 'stale' });
  assert.deepEqual(parseDigestNotification({ kind: 'weekly_digest', type: 'weekly_digest', week_start: 'not-a-date', city: 'tel_aviv' }, saturday), { status: 'malformed' });
});
