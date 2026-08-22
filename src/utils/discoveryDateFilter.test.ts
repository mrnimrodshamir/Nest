import test from 'node:test';
import assert from 'node:assert/strict';
import { DISCOVERY_DEFAULT_HORIZON_DAYS, isWithinDiscoveryDateRange, resolveDiscoveryDateRange } from '@/utils/discoveryDateFilter';

// A fixed instant well clear of any Jerusalem DST transition, matching the
// pattern used by supabase/functions/_shared/dailyDigest tests.
const NOW = new Date('2026-08-22T10:00:00.000Z'); // Saturday, Jerusalem UTC+3

test('default (next30) horizon is exactly TODAY through NEXT 30 DAYS', () => {
  const range = resolveDiscoveryDateRange('next30', NOW);
  assert.equal(range.start.toISOString(), '2026-08-21T21:00:00.000Z'); // Jerusalem midnight
  assert.equal(range.end?.toISOString(), '2026-09-20T21:00:00.000Z');
  const days = range.end !== null ? Math.round((range.end.getTime() - range.start.getTime()) / (24 * 60 * 60 * 1000)) : -1;
  assert.equal(days, DISCOVERY_DEFAULT_HORIZON_DAYS);
});

test('an Event exactly at the 30-day boundary is excluded from the default horizon', () => {
  const range = resolveDiscoveryDateRange('next30', NOW);
  // end is exclusive: an occurrence starting exactly at `end` is day 31, not day 30.
  assert.equal(isWithinDiscoveryDateRange(range.end!.toISOString(), range), false);
});

test('an Event one millisecond before the boundary is included', () => {
  const range = resolveDiscoveryDateRange('next30', NOW);
  const justBefore = new Date(range.end!.getTime() - 1).toISOString();
  assert.equal(isWithinDiscoveryDateRange(justBefore, range), true);
});

test('a far-future Event is excluded from the default horizon but reachable via the explicit "all" filter', () => {
  const farFuture = '2027-06-01T12:00:00.000Z';
  const defaultRange = resolveDiscoveryDateRange('next30', NOW);
  assert.equal(isWithinDiscoveryDateRange(farFuture, defaultRange), false);
  const allRange = resolveDiscoveryDateRange('all', NOW);
  assert.equal(allRange.end, null);
  assert.equal(isWithinDiscoveryDateRange(farFuture, allRange), true);
});

test('an Event before today is excluded from every filter, including "all"', () => {
  const yesterday = '2026-08-21T08:00:00.000Z';
  for (const key of ['next30', 'today', 'week', 'next7', 'all'] as const) {
    assert.equal(isWithinDiscoveryDateRange(yesterday, resolveDiscoveryDateRange(key, NOW)), false, key);
  }
});

test('today includes only the current Jerusalem calendar day', () => {
  const range = resolveDiscoveryDateRange('today', NOW);
  assert.equal(isWithinDiscoveryDateRange('2026-08-22T05:00:00.000Z', range), true); // 08:00 Jerusalem
  assert.equal(isWithinDiscoveryDateRange('2026-08-22T22:00:00.000Z', range), false); // next Jerusalem day
});

test('tomorrow is the single following Jerusalem calendar day, not today', () => {
  const range = resolveDiscoveryDateRange('tomorrow', NOW);
  assert.equal(isWithinDiscoveryDateRange('2026-08-22T10:00:00.000Z', range), false); // still today
  assert.equal(isWithinDiscoveryDateRange('2026-08-23T10:00:00.000Z', range), true);
  assert.equal(isWithinDiscoveryDateRange('2026-08-24T10:00:00.000Z', range), false);
});

test('next7 is a rolling 7-day window from today, independent of the calendar week', () => {
  const range = resolveDiscoveryDateRange('next7', NOW);
  const days = Math.round((range.end!.getTime() - range.start.getTime()) / (24 * 60 * 60 * 1000));
  assert.equal(days, 7);
});

test('weekend resolves to the nearest Friday–Saturday', () => {
  // NOW is a Saturday; the nearest weekend start (Friday) is the day before.
  const range = resolveDiscoveryDateRange('weekend', NOW);
  assert.equal(range.start.toISOString(), '2026-08-20T21:00:00.000Z'); // Friday midnight Jerusalem
  const days = Math.round((range.end!.getTime() - range.start.getTime()) / (24 * 60 * 60 * 1000));
  assert.equal(days, 2);
});

test('week covers the rest of the current Sun-Sat week, ending before the next Sunday', () => {
  // A Tuesday anchor, not NOW (a Saturday, the last day of its own week —
  // a true edge case covered separately below).
  const tuesday = new Date('2026-08-18T10:00:00.000Z');
  const range = resolveDiscoveryDateRange('week', tuesday);
  // Later the same week must be included...
  assert.equal(isWithinDiscoveryDateRange('2026-08-21T10:00:00.000Z', range), true);
  // ...while the following Sunday must not be.
  assert.equal(isWithinDiscoveryDateRange('2026-08-23T10:00:00.000Z', range), false);
});

test('week on a Saturday covers only that single remaining day', () => {
  // Saturday is the last day of the Sun-Sat week, so "this week" from a
  // Saturday cannot roll into the following week.
  const range = resolveDiscoveryDateRange('week', NOW);
  const days = Math.round((range.end!.getTime() - range.start.getTime()) / (24 * 60 * 60 * 1000));
  assert.equal(days, 1);
});

test('an invalid timestamp is never considered within range', () => {
  assert.equal(isWithinDiscoveryDateRange('not-a-date', resolveDiscoveryDateRange('all', NOW)), false);
});
