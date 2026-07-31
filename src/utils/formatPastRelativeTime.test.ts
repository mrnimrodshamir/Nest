import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatPastRelativeTime } from './formatPastRelativeTime.ts';

test('formatPastRelativeTime: under an hour reads as "Just now"', () => {
  const now = new Date(2026, 6, 31, 12, 0);
  const thirtyMinAgo = new Date(2026, 6, 31, 11, 35);
  assert.equal(formatPastRelativeTime(thirtyMinAgo.toISOString(), now), 'Just now');
});

test('formatPastRelativeTime: same-day hours ago', () => {
  const now = new Date(2026, 6, 31, 22, 0);
  const elevenHoursAgo = new Date(2026, 6, 31, 11, 0);
  assert.equal(formatPastRelativeTime(elevenHoursAgo.toISOString(), now), '11 hours ago');
});

test('formatPastRelativeTime: singular hour', () => {
  const now = new Date(2026, 6, 31, 13, 0);
  const oneHourAgo = new Date(2026, 6, 31, 12, 0);
  assert.equal(formatPastRelativeTime(oneHourAgo.toISOString(), now), '1 hour ago');
});

test('formatPastRelativeTime: exactly the previous calendar day is "Yesterday"', () => {
  const now = new Date(2026, 6, 31, 9, 0);
  const yesterday = new Date(2026, 6, 30, 20, 0);
  assert.equal(formatPastRelativeTime(yesterday.toISOString(), now), 'Yesterday');
});

test('formatPastRelativeTime: a few days ago', () => {
  const now = new Date(2026, 6, 31, 9, 0);
  const threeDaysAgo = new Date(2026, 6, 28, 9, 0);
  assert.equal(formatPastRelativeTime(threeDaysAgo.toISOString(), now), '3 days ago');
});

test('formatPastRelativeTime: a week or more falls back to a short date', () => {
  const now = new Date(2026, 6, 31, 9, 0);
  const twoWeeksAgo = new Date(2026, 6, 17, 9, 0);
  assert.equal(formatPastRelativeTime(twoWeeksAgo.toISOString(), now), 'Jul 17');
});
