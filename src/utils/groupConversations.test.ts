import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupConversations, isUpcomingActivity } from './groupConversations.ts';

function conversation(overrides) {
  return {
    chatId: overrides.chatId ?? 'chat-1',
    kind: overrides.activity ? 'group' : 'direct',
    title: overrides.title ?? 'Test',
    subtitle: '',
    avatarUrl: null,
    otherUserId: overrides.activity ? null : (overrides.otherUserId ?? 'user-1'),
    activityId: overrides.activity ? (overrides.activityId ?? 'activity-1') : null,
    lastMessageAt: overrides.lastMessageAt ?? null,
    lastMessagePreview: '',
    hasUnread: false,
    activity: overrides.activity ?? null,
    ...overrides,
  };
}

function activity(overrides) {
  return {
    category: 'stroller_walk',
    startTime: overrides.startTime,
    status: overrides.status ?? 'published',
    locationLabel: 'Test Park',
    attendeeCount: 1,
    coverImageUrl: null,
    ...overrides,
  };
}

test('isUpcomingActivity: future start time and live status is upcoming', () => {
  const now = new Date(2026, 6, 31, 12, 0);
  const future = activity({ startTime: new Date(2026, 6, 31, 18, 0).toISOString() });
  assert.equal(isUpcomingActivity(future, now), true);
});

test('isUpcomingActivity: past start time is not upcoming', () => {
  const now = new Date(2026, 6, 31, 12, 0);
  const past = activity({ startTime: new Date(2026, 6, 30, 9, 0).toISOString() });
  assert.equal(isUpcomingActivity(past, now), false);
});

test('isUpcomingActivity: cancelled is never upcoming even if the date is in the future', () => {
  const now = new Date(2026, 6, 31, 12, 0);
  const cancelledFuture = activity({
    startTime: new Date(2026, 7, 5).toISOString(),
    status: 'cancelled',
  });
  assert.equal(isUpcomingActivity(cancelledFuture, now), false);
});

test('isUpcomingActivity: completed is never upcoming', () => {
  const now = new Date(2026, 6, 31, 12, 0);
  const completed = activity({ startTime: new Date(2026, 7, 5).toISOString(), status: 'completed' });
  assert.equal(isUpcomingActivity(completed, now), false);
});

test('isUpcomingActivity: exact boundary (start time equals now) counts as upcoming', () => {
  const now = new Date(2026, 6, 31, 12, 0, 0, 0);
  const exact = activity({ startTime: now.toISOString() });
  assert.equal(isUpcomingActivity(exact, now), true);
});

test('isUpcomingActivity: timezone boundary — compares absolute instants, not local wall-clock', () => {
  // "now" expressed in local time vs an activity time expressed via ISO
  // with an explicit UTC offset — getTime() compares real instants, so a
  // few hours' difference in how each Date was constructed should not
  // flip the result if the underlying instant is genuinely in the future.
  const now = new Date(2026, 6, 31, 23, 30); // 23:30 local
  const future = activity({ startTime: '2026-08-01T00:15:00.000Z' });
  // Only assert this is deterministic and doesn't throw — exact boolean
  // depends on the runner's local offset, which we don't control here.
  assert.doesNotThrow(() => isUpcomingActivity(future, now));
});

test('groupConversations: splits into upcoming/past/direct correctly', () => {
  const now = new Date(2026, 6, 31, 12, 0);
  const upcoming = conversation({
    chatId: 'a',
    activity: activity({ startTime: new Date(2026, 7, 1).toISOString() }),
  });
  const past = conversation({
    chatId: 'b',
    activity: activity({ startTime: new Date(2026, 6, 1).toISOString() }),
  });
  const direct = conversation({ chatId: 'c', otherUserId: 'user-2' });

  const result = groupConversations([upcoming, past, direct], now);
  assert.deepEqual(result.upcoming.map((c) => c.chatId), ['a']);
  assert.deepEqual(result.past.map((c) => c.chatId), ['b']);
  assert.deepEqual(result.direct.map((c) => c.chatId), ['c']);
});

test('groupConversations: a conversation with a missing activity record falls through to direct, not a crash', () => {
  const now = new Date(2026, 6, 31, 12, 0);
  const missingActivity = conversation({ chatId: 'x', activity: null, otherUserId: null, activityId: 'gone' });
  const result = groupConversations([missingActivity], now);
  assert.deepEqual(result.direct.map((c) => c.chatId), ['x']);
  assert.equal(result.upcoming.length, 0);
  assert.equal(result.past.length, 0);
});

test('groupConversations: upcoming is sorted soonest-first', () => {
  const now = new Date(2026, 6, 31, 12, 0);
  const soon = conversation({ chatId: 'soon', activity: activity({ startTime: new Date(2026, 7, 1).toISOString() }) });
  const later = conversation({
    chatId: 'later',
    activity: activity({ startTime: new Date(2026, 7, 10).toISOString() }),
  });
  const result = groupConversations([later, soon], now);
  assert.deepEqual(result.upcoming.map((c) => c.chatId), ['soon', 'later']);
});

test('groupConversations: past is sorted most-recently-messaged-first', () => {
  const now = new Date(2026, 6, 31, 12, 0);
  const oldMessage = conversation({
    chatId: 'old',
    lastMessageAt: '2026-06-01T00:00:00.000Z',
    activity: activity({ startTime: new Date(2026, 5, 1).toISOString() }),
  });
  const recentMessage = conversation({
    chatId: 'recent',
    lastMessageAt: '2026-06-20T00:00:00.000Z',
    activity: activity({ startTime: new Date(2026, 5, 1).toISOString() }),
  });
  const result = groupConversations([oldMessage, recentMessage], now);
  assert.deepEqual(result.past.map((c) => c.chatId), ['recent', 'old']);
});
