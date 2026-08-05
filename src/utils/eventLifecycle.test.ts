import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveEventLifecycle } from '@/utils/eventLifecycle';

const base = {
  eventStatus: 'scheduled' as const,
  occurrenceStatus: 'scheduled' as const,
  startsAt: '2026-08-06T15:00:00.000Z',
  endsAt: '2026-08-06T16:00:00.000Z',
  timezone: 'Asia/Jerusalem',
};

test('event lifecycle distinguishes upcoming, today, live, and finished', () => {
  assert.equal(resolveEventLifecycle(base, new Date('2026-08-05T12:00:00Z')), 'upcoming');
  assert.equal(resolveEventLifecycle(base, new Date('2026-08-06T08:00:00Z')), 'today');
  assert.equal(resolveEventLifecycle(base, new Date('2026-08-06T15:00:00Z')), 'live');
  assert.equal(resolveEventLifecycle(base, new Date('2026-08-06T16:00:00Z')), 'finished');
});

test('cancellation and postponement override clock lifecycle', () => {
  assert.equal(resolveEventLifecycle({ ...base, eventStatus: 'cancelled' }, new Date('2026-08-05T12:00:00Z')), 'cancelled');
  assert.equal(resolveEventLifecycle({ ...base, occurrenceStatus: 'cancelled' }, new Date('2026-08-06T15:30:00Z')), 'cancelled');
  assert.equal(resolveEventLifecycle({ ...base, occurrenceStatus: 'postponed' }, new Date('2026-08-07T15:30:00Z')), 'postponed');
});

test('an event without an explicit end becomes finished at its start rather than inventing duration', () => {
  assert.equal(resolveEventLifecycle({ ...base, endsAt: null }, new Date(base.startsAt)), 'finished');
});

test('invalid event times and timezones fail safely', () => {
  assert.throws(() => resolveEventLifecycle({ ...base, startsAt: 'invalid' }), /Invalid event startsAt/);
  assert.throws(() => resolveEventLifecycle({ ...base, endsAt: '2026-08-06T14:00:00Z' }), /must not precede/);
  assert.throws(() => resolveEventLifecycle({ ...base, timezone: 'Not\/AZone' }), /Invalid event timezone/);
});
