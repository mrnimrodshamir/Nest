import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isDailyDigestSendWindow, isWeeklyDigestSendWindow, jerusalemLocalDateString, weeklyDigestPeriod } from './scheduleGate.ts';

test('07:00 Jerusalem (IDT, summer UTC+3) is inside the send window', () => {
  // 2026-08-20 07:05 Asia/Jerusalem == 04:05 UTC in August (IDT, UTC+3).
  assert.equal(isDailyDigestSendWindow(new Date('2026-08-20T04:05:00Z')), true);
});

test('07:00 Jerusalem (IST, winter UTC+2) is inside the send window', () => {
  // 2026-01-20 07:05 Asia/Jerusalem == 05:05 UTC in January (IST, UTC+2) —
  // same wall-clock target, different UTC offset. A naive fixed-UTC cron
  // would miss this.
  assert.equal(isDailyDigestSendWindow(new Date('2026-01-20T05:05:00Z')), true);
});

test('06:59 and 07:16 Jerusalem are outside the default 15-minute window', () => {
  assert.equal(isDailyDigestSendWindow(new Date('2026-08-20T03:59:00Z')), false); // 06:59 IDT
  assert.equal(isDailyDigestSendWindow(new Date('2026-08-20T04:16:00Z')), false); // 07:16 IDT
});

test('the window boundary lands on the same wall-clock target on both sides of DST', () => {
  // Israel standard time (IST, UTC+2) in February vs daylight time (IDT,
  // UTC+3) in April — different UTC offsets, same 07:00-07:15 local target.
  // 06:59 local is false, 07:00 and 07:14 are true, 07:15 is false, in BOTH.
  const cases: Array<[string, boolean]> = [
    ['2026-02-15T04:59:00Z', false], // 06:59 IST
    ['2026-02-15T05:00:00Z', true],  // 07:00 IST
    ['2026-02-15T05:14:00Z', true],  // 07:14 IST
    ['2026-02-15T05:15:00Z', false], // 07:15 IST
    ['2026-04-15T03:59:00Z', false], // 06:59 IDT
    ['2026-04-15T04:00:00Z', true],  // 07:00 IDT
    ['2026-04-15T04:14:00Z', true],  // 07:14 IDT
    ['2026-04-15T04:15:00Z', false], // 07:15 IDT
  ];
  for (const [iso, expected] of cases) {
    assert.equal(isDailyDigestSendWindow(new Date(iso)), expected, iso);
  }
});

test('jerusalemLocalDateString rolls over at Jerusalem midnight, not UTC midnight', () => {
  // 2026-08-20 00:30 Jerusalem (IDT, UTC+3) is 2026-08-19 21:30 UTC.
  assert.equal(jerusalemLocalDateString(new Date('2026-08-19T21:30:00Z')), '2026-08-20');
  // And the reverse: 23:30 UTC on the 19th is still the 19th in Jerusalem
  // (02:30 on the 20th local) — pick a moment that's unambiguously the
  // previous UTC day but already the next Jerusalem day.
  assert.equal(jerusalemLocalDateString(new Date('2026-08-19T20:59:00Z')), '2026-08-19');
});

test('a custom window size widens or narrows the eligible minutes', () => {
  assert.equal(isDailyDigestSendWindow(new Date('2026-08-20T04:29:00Z'), 30), true); // 07:29, 30-min window
  assert.equal(isDailyDigestSendWindow(new Date('2026-08-20T04:31:00Z'), 30), false); // 07:31, 30-min window
});

test('Weekly opens only Saturday at 19:00 Jerusalem across DST', () => {
  assert.equal(isWeeklyDigestSendWindow(new Date('2026-08-22T16:05:00Z')), true); // 19:05 IDT
  assert.equal(isWeeklyDigestSendWindow(new Date('2026-01-24T17:05:00Z')), true); // 19:05 IST
  assert.equal(isWeeklyDigestSendWindow(new Date('2026-08-22T15:59:00Z')), false);
  assert.equal(isWeeklyDigestSendWindow(new Date('2026-08-23T16:05:00Z')), false);
});

test('Weekly period is the coming Sunday-Saturday and crosses month/year safely', () => {
  assert.deepEqual(weeklyDigestPeriod(new Date('2026-08-22T16:05:00Z')), {
    weekStart: '2026-08-23',
    weekEnd: '2026-08-29',
    days: ['2026-08-23', '2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28', '2026-08-29'],
  });
  assert.equal(weeklyDigestPeriod(new Date('2026-08-29T16:05:00Z')).weekEnd, '2026-09-05');
  const year = weeklyDigestPeriod(new Date('2026-12-26T17:05:00Z'));
  assert.equal(year.weekStart, '2026-12-27');
  assert.equal(year.weekEnd, '2027-01-02');
});
