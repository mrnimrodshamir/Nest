import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isLiveActivity, splitMyActivities } from './splitMyActivities.ts';

const NOW = new Date(2026, 6, 31, 12, 0);

function activity(overrides) {
  return {
    id: 'activity-1',
    startTime: new Date(2026, 6, 31, 18, 0).toISOString(),
    status: 'published',
    ...overrides,
  };
}

test('isLiveActivity: published and full are live', () => {
  assert.equal(isLiveActivity({ status: 'published' }), true);
  assert.equal(isLiveActivity({ status: 'full' }), true);
});

test('isLiveActivity: cancelled and completed are never live', () => {
  assert.equal(isLiveActivity({ status: 'cancelled' }), false);
  assert.equal(isLiveActivity({ status: 'completed' }), false);
});

test('splitMyActivities: a future published activity is upcoming', () => {
  const { upcoming, past } = splitMyActivities([activity({})], NOW);
  assert.equal(upcoming.length, 1);
  assert.equal(past.length, 0);
});

test('splitMyActivities: a cancelled activity moves to past even with a future start time', () => {
  const { upcoming, past } = splitMyActivities(
    [activity({ id: 'cancelled-future', status: 'cancelled' })],
    NOW,
  );
  assert.equal(upcoming.length, 0);
  assert.equal(past.length, 1);
  assert.equal(past[0].id, 'cancelled-future');
});

test('splitMyActivities: a completed activity moves to past even with a future start time', () => {
  const { upcoming, past } = splitMyActivities(
    [activity({ id: 'completed-future', status: 'completed' })],
    NOW,
  );
  assert.equal(upcoming.length, 0);
  assert.equal(past.length, 1);
});

test('splitMyActivities: a past-start-time live activity is past, not upcoming', () => {
  const { upcoming, past } = splitMyActivities(
    [activity({ startTime: new Date(2026, 6, 30, 9, 0).toISOString() })],
    NOW,
  );
  assert.equal(upcoming.length, 0);
  assert.equal(past.length, 1);
});

test('splitMyActivities: exact-boundary start time counts as upcoming', () => {
  const { upcoming } = splitMyActivities([activity({ startTime: NOW.toISOString() })], NOW);
  assert.equal(upcoming.length, 1);
});

test('splitMyActivities: upcoming is sorted soonest-first, past is sorted most-recent-first', () => {
  const soon = activity({ id: 'soon', startTime: new Date(2026, 6, 31, 13, 0).toISOString() });
  const later = activity({ id: 'later', startTime: new Date(2026, 6, 31, 20, 0).toISOString() });
  const recentPast = activity({ id: 'recent-past', startTime: new Date(2026, 6, 30, 20, 0).toISOString() });
  const olderPast = activity({ id: 'older-past', startTime: new Date(2026, 6, 20, 9, 0).toISOString() });

  const { upcoming, past } = splitMyActivities([later, soon, olderPast, recentPast], NOW);
  assert.deepEqual(upcoming.map((a) => a.id), ['soon', 'later']);
  assert.deepEqual(past.map((a) => a.id), ['recent-past', 'older-past']);
});
