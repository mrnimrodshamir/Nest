import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveLifecycle,
  resolveEndTime,
  resolveSpotsLeft,
  resolveBadges,
  lifecycleLabel,
  STARTING_SOON_WINDOW_MINUTES,
  type LifecycleInput,
} from './activityLifecycle.ts';

const NOW = new Date('2026-08-03T12:00:00.000Z');
const MIN = 60_000;

function activity(over: Partial<LifecycleInput> = {}): LifecycleInput {
  return {
    status: 'published',
    startTime: new Date(NOW.getTime() + 24 * 60 * MIN).toISOString(),
    endTime: null,
    durationMinutes: 60,
    capacity: 8,
    attendeeCount: 2,
    ...over,
  };
}

test('future activity with room reads as Upcoming', () => {
  assert.equal(resolveLifecycle(activity(), NOW), 'upcoming');
});

test('starting soon opens exactly 60 minutes before start', () => {
  const start = new Date(NOW.getTime() + STARTING_SOON_WINDOW_MINUTES * MIN).toISOString();
  assert.equal(resolveLifecycle(activity({ startTime: start }), NOW), 'starting_soon');
});

test('one minute before the window opens it is still Upcoming', () => {
  const start = new Date(NOW.getTime() + (STARTING_SOON_WINDOW_MINUTES + 1) * MIN).toISOString();
  assert.equal(resolveLifecycle(activity({ startTime: start }), NOW), 'upcoming');
});

test('starting soon ends at the exact start instant — start flips to In progress', () => {
  const start = NOW.toISOString();
  assert.equal(resolveLifecycle(activity({ startTime: start }), NOW), 'in_progress');
});

test('In progress applies between start and end', () => {
  const start = new Date(NOW.getTime() - 30 * MIN).toISOString();
  assert.equal(resolveLifecycle(activity({ startTime: start, durationMinutes: 60 }), NOW), 'in_progress');
});

test('Completed the instant the end time is reached', () => {
  const start = new Date(NOW.getTime() - 60 * MIN).toISOString();
  assert.equal(resolveLifecycle(activity({ startTime: start, durationMinutes: 60 }), NOW), 'completed');
});

test('explicit end time wins over start + duration', () => {
  const start = new Date(NOW.getTime() - 30 * MIN).toISOString();
  // duration says it ended 20min ago, but the explicit end is in the future
  const end = new Date(NOW.getTime() + 30 * MIN).toISOString();
  const input = activity({ startTime: start, durationMinutes: 10, endTime: end });
  assert.equal(resolveEndTime(input), new Date(end).getTime());
  assert.equal(resolveLifecycle(input, NOW), 'in_progress');
});

test('server-marked completed is honoured even if the clock disagrees', () => {
  assert.equal(resolveLifecycle(activity({ status: 'completed' }), NOW), 'completed');
});

test('Full when active attendees reach capacity', () => {
  assert.equal(resolveLifecycle(activity({ capacity: 4, attendeeCount: 4 }), NOW), 'full');
});

test('over-subscribed still reads Full, never negative spots', () => {
  const input = activity({ capacity: 4, attendeeCount: 6 });
  assert.equal(resolveSpotsLeft(input), 0);
  assert.equal(resolveLifecycle(input, NOW), 'full');
});

test('one spot left', () => {
  const input = activity({ capacity: 4, attendeeCount: 3 });
  assert.equal(resolveLifecycle(input, NOW), 'spots_left');
  assert.equal(lifecycleLabel('spots_left', resolveSpotsLeft(input)), '1 spot left');
});

test('several spots left is pluralised', () => {
  const input = activity({ capacity: 8, attendeeCount: 5 });
  assert.equal(resolveLifecycle(input, NOW), 'spots_left');
  assert.equal(lifecycleLabel('spots_left', resolveSpotsLeft(input)), '3 spots left');
});

test('uncapped capacity is never Full and never scarce', () => {
  const input = activity({ capacity: null, attendeeCount: 500 });
  assert.equal(resolveSpotsLeft(input), null);
  assert.equal(resolveLifecycle(input, NOW), 'upcoming');
});

test('cancelled overrides Full', () => {
  assert.equal(
    resolveLifecycle(activity({ status: 'cancelled', capacity: 4, attendeeCount: 4 }), NOW),
    'cancelled',
  );
});

test('cancelled overrides Completed and In progress', () => {
  const past = new Date(NOW.getTime() - 300 * MIN).toISOString();
  assert.equal(resolveLifecycle(activity({ status: 'cancelled', startTime: past }), NOW), 'cancelled');
});

test('cancelled overrides Starting soon', () => {
  const soon = new Date(NOW.getTime() + 10 * MIN).toISOString();
  assert.equal(resolveLifecycle(activity({ status: 'cancelled', startTime: soon }), NOW), 'cancelled');
});

test('a concurrent join that fills the activity flips spots_left to full', () => {
  const before = activity({ capacity: 4, attendeeCount: 3 });
  assert.equal(resolveLifecycle(before, NOW), 'spots_left');
  const after = { ...before, attendeeCount: 4 };
  assert.equal(resolveLifecycle(after, NOW), 'full');
});

test('UI badges: Upcoming is visible and relationship remains separate', () => {
  const badges = resolveBadges(activity(), 'hosting', NOW);
  assert.equal(badges.lifecycle, 'Upcoming');
  assert.equal(badges.relationship, 'Hosting');
});

test('badges: at most one lifecycle and one relationship badge', () => {
  const badges = resolveBadges(activity({ capacity: 4, attendeeCount: 3 }), 'joined', NOW);
  assert.equal(badges.lifecycle, '1 spot left');
  assert.equal(badges.relationship, 'Joined');
});

test('badges: relationship is dropped once cancelled — "Hosting" must not read as live', () => {
  const badges = resolveBadges(activity({ status: 'cancelled' }), 'hosting', NOW);
  assert.equal(badges.lifecycle, 'Cancelled');
  assert.equal(badges.relationship, null);
});

test('badges: relationship is dropped once completed', () => {
  const badges = resolveBadges(activity({ status: 'completed' }), 'joined', NOW);
  assert.equal(badges.lifecycle, 'Completed');
  assert.equal(badges.relationship, null);
});

test('badges: no relationship badge for a non-participant', () => {
  const badges = resolveBadges(activity({ capacity: 4, attendeeCount: 4 }), 'none', NOW);
  assert.equal(badges.lifecycle, 'Full');
  assert.equal(badges.relationship, null);
});

test('priority order holds when every condition is simultaneously true', () => {
  // cancelled + past end + capacity full + would-be starting soon
  const input = activity({
    status: 'cancelled',
    startTime: new Date(NOW.getTime() - 600 * MIN).toISOString(),
    capacity: 2,
    attendeeCount: 2,
  });
  assert.equal(resolveLifecycle(input, NOW), 'cancelled');
});
