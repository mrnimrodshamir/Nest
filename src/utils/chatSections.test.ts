import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chatSections, shouldShowEmptyState, sortForums, unreadSectionCount } from './chatSections.ts';
import type { Conversation } from '@/hooks/useConversations';
import type { ForumSummary } from '@/hooks/useForums';

const NOW = new Date('2026-08-08T12:00:00Z');

function groupChat(id: string, startTime: string, overrides: Partial<Conversation> = {}): Conversation {
  return {
    chatId: id, kind: 'group', title: id, subtitle: '', avatarUrl: null,
    otherUserId: null, activityId: id, lastMessageAt: startTime,
    lastMessagePreview: '', lastMessageSenderName: null, hasUnread: false,
    activity: {
      category: 'community' as never, startTime, status: 'active' as never,
      locationLabel: 'Tel Aviv', attendeeCount: 2, coverImageUrl: null,
    },
    ...overrides,
  };
}

function directChat(id: string, lastMessageAt: string, overrides: Partial<Conversation> = {}): Conversation {
  return {
    chatId: id, kind: 'direct', title: id, subtitle: '', avatarUrl: null,
    otherUserId: 'u1', activityId: null, lastMessageAt,
    lastMessagePreview: '', lastMessageSenderName: null, hasUnread: false,
    activity: null, ...overrides,
  };
}

function forum(key: string, sortOrder: number, hasUnread = false): ForumSummary {
  return {
    key: key as never, chatId: `chat-${key}`,
    titleKey: 'forum.breastfeeding.title', descriptionKey: 'forum.breastfeeding.description',
    icon: 'heart', sortOrder, lastMessagePreview: null, lastMessageAt: null,
    lastMessageSenderName: null, hasUnread,
  };
}

// --- The three-way split ---------------------------------------------------

test('future activity chats land in active, past ones in past', () => {
  const future = groupChat('future', '2026-09-01T10:00:00Z');
  const over = groupChat('over', '2026-08-01T10:00:00Z');
  const result = chatSections([over, future], NOW);
  assert.deepEqual(result.active.map((c) => c.chatId), ['future']);
  assert.deepEqual(result.past.map((c) => c.chatId), ['over']);
});

test('direct chats are always active — they have no date to expire', () => {
  const old = directChat('dm', '2020-01-01T00:00:00Z');
  const result = chatSections([old], NOW);
  assert.deepEqual(result.active.map((c) => c.chatId), ['dm']);
  assert.deepEqual(result.past, []);
});

test('a cancelled activity is past even if its start time is in the future', () => {
  const cancelled = groupChat('x', '2026-12-01T10:00:00Z', {
    activity: { category: 'community' as never, startTime: '2026-12-01T10:00:00Z', status: 'cancelled' as never, locationLabel: 'TLV', attendeeCount: 1, coverImageUrl: null },
  });
  assert.deepEqual(chatSections([cancelled], NOW).past.map((c) => c.chatId), ['x']);
});

test('a completed activity is past', () => {
  const done = groupChat('x', '2026-12-01T10:00:00Z', {
    activity: { category: 'community' as never, startTime: '2026-12-01T10:00:00Z', status: 'completed' as never, locationLabel: 'TLV', attendeeCount: 1, coverImageUrl: null },
  });
  assert.deepEqual(chatSections([done], NOW).past.map((c) => c.chatId), ['x']);
});

test('ORDERING: dated activity chats precede direct chats in active', () => {
  const soon = groupChat('soon', '2026-08-09T10:00:00Z');
  const later = groupChat('later', '2026-08-20T10:00:00Z');
  // A very recent direct chat must not outrank tomorrow's meetup.
  const recentDm = directChat('dm', '2026-08-08T11:59:00Z');
  const result = chatSections([recentDm, later, soon], NOW);
  assert.deepEqual(result.active.map((c) => c.chatId), ['soon', 'later', 'dm']);
});

test('past chats are ordered by most recent message', () => {
  const a = groupChat('a', '2026-08-01T10:00:00Z', { lastMessageAt: '2026-08-02T10:00:00Z' });
  const b = groupChat('b', '2026-08-01T10:00:00Z', { lastMessageAt: '2026-08-05T10:00:00Z' });
  assert.deepEqual(chatSections([a, b], NOW).past.map((c) => c.chatId), ['b', 'a']);
});

test('an empty inbox yields two empty sections, not an error', () => {
  const result = chatSections([], NOW);
  assert.deepEqual(result.active, []);
  assert.deepEqual(result.past, []);
});

test('SEPARATION: forums are never mixed into the conversation sections', () => {
  const result = chatSections([groupChat('g', '2026-09-01T10:00:00Z'), directChat('d', '2026-08-01T00:00:00Z')], NOW);
  const all = [...result.active, ...result.past];
  assert.equal(all.length, 2);
  // ChatSections has exactly two keys; forums come from their own source.
  assert.deepEqual(Object.keys(result).sort(), ['active', 'past']);
});

// --- Forum ordering --------------------------------------------------------

test('forums render in curated order, never by recency', () => {
  const unsorted = [forum('c', 30), forum('a', 10), forum('b', 20)];
  assert.deepEqual(sortForums(unsorted).map((f) => f.key), ['a', 'b', 'c']);
});

test('forum order is stable across calls and does not mutate the input', () => {
  const input = [forum('c', 30), forum('a', 10)];
  const first = sortForums(input).map((f) => f.key);
  const second = sortForums(input).map((f) => f.key);
  assert.deepEqual(first, second);
  assert.deepEqual(input.map((f) => f.key), ['c', 'a'], 'input was mutated');
});

test('equal sort orders fall back to key so ordering stays total', () => {
  assert.deepEqual(sortForums([forum('z', 10), forum('a', 10)]).map((f) => f.key), ['a', 'z']);
});

// --- Empty states ----------------------------------------------------------

test('conversation sections show an empty state when genuinely empty', () => {
  assert.equal(shouldShowEmptyState('active', 0, false), true);
  assert.equal(shouldShowEmptyState('past', 0, false), true);
});

test('a failed load shows retry, never a misleading empty state', () => {
  assert.equal(shouldShowEmptyState('active', 0, true), false);
  assert.equal(shouldShowEmptyState('past', 0, true), false);
});

test('forums NEVER show an empty state — seeded forums cannot be legitimately empty', () => {
  assert.equal(shouldShowEmptyState('forums', 0, false), false);
  assert.equal(shouldShowEmptyState('forums', 0, true), false);
});

test('a populated section never shows an empty state', () => {
  assert.equal(shouldShowEmptyState('active', 3, false), false);
});

// --- Unread ----------------------------------------------------------------

test('unread counts span conversations and forums', () => {
  const conversations = [groupChat('a', '2026-09-01T10:00:00Z', { hasUnread: true }), directChat('b', '2026-08-01T00:00:00Z')];
  assert.equal(unreadSectionCount(conversations, [forum('f', 10, true), forum('g', 20)]), 2);
});

test('nothing unread counts as zero', () => {
  assert.equal(unreadSectionCount([], []), 0);
});
