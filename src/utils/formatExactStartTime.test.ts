import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatExactStartTime } from './formatExactStartTime.ts';

test('formatExactStartTime: same-day future activity shows exact time plus relative hours', () => {
  const now = new Date(2026, 6, 31, 19, 0);
  const start = new Date(2026, 6, 31, 21, 0);
  const result = formatExactStartTime(start.toISOString(), now);
  assert.match(result, /^Today at/);
  assert.match(result, /In 2 hours/);
});

test('formatExactStartTime: same-day, under an hour away, shows minutes', () => {
  const now = new Date(2026, 6, 31, 20, 45);
  const start = new Date(2026, 6, 31, 21, 0);
  const result = formatExactStartTime(start.toISOString(), now);
  assert.match(result, /^Today at/);
  assert.match(result, /In 15 min/);
});

test('formatExactStartTime: tomorrow shows exact time with a Tomorrow label, no relative suffix', () => {
  const now = new Date(2026, 6, 31, 20, 0);
  const start = new Date(2026, 7, 1, 9, 0);
  const result = formatExactStartTime(start.toISOString(), now);
  assert.match(result, /^Tomorrow at/);
  assert.doesNotMatch(result, /In \d/);
});

test('formatExactStartTime: a further-out future date shows weekday, month and day', () => {
  const now = new Date(2026, 6, 27, 8, 0); // Monday
  const start = new Date(2026, 6, 31, 21, 0); // Friday
  const result = formatExactStartTime(start.toISOString(), now);
  assert.match(result, /^Fri, Jul 31 at/);
});

test('formatExactStartTime: a past activity earlier today reads "Today at <time>", never a negative "In" value', () => {
  const now = new Date(2026, 6, 31, 22, 0);
  const start = new Date(2026, 6, 31, 9, 0);
  const result = formatExactStartTime(start.toISOString(), now);
  assert.match(result, /^Today at/);
  assert.doesNotMatch(result, /In -?\d/);
});

test('formatExactStartTime: a past activity on an earlier date shows its exact date, not a same-day label', () => {
  const now = new Date(2026, 6, 31, 12, 0);
  const start = new Date(2026, 6, 20, 9, 0);
  const result = formatExactStartTime(start.toISOString(), now);
  const expectedWeekday = start.toLocaleDateString(undefined, { weekday: 'short' });
  assert.match(result, new RegExp(`^${expectedWeekday}, Jul 20 at`));
});

test('formatExactStartTime: midnight boundary -- an activity one minute past midnight tonight is Tomorrow, not Today', () => {
  const now = new Date(2026, 6, 31, 23, 59);
  const start = new Date(2026, 7, 1, 0, 1);
  const result = formatExactStartTime(start.toISOString(), now);
  assert.match(result, /^Tomorrow at/);
});

test('formatExactStartTime: midnight boundary -- an activity at exactly midnight tonight still reads Today', () => {
  const now = new Date(2026, 6, 31, 22, 0);
  const start = new Date(2026, 6, 31, 0, 0);
  const result = formatExactStartTime(start.toISOString(), now);
  assert.match(result, /^Today at/);
});

test('formatExactStartTime: time label always includes an explicit AM/PM marker, never a bare ambiguous hour', () => {
  const now = new Date(2026, 6, 31, 8, 0);
  const start = new Date(2026, 6, 31, 21, 0);
  const result = formatExactStartTime(start.toISOString(), now);
  assert.match(result, /\d{1,2}:\d{2}\s?(AM|PM)/i);
});
