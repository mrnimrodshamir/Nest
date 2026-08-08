import { test } from 'node:test';
import assert from 'node:assert/strict';
import { activityCapacityPresentation, LOW_CAPACITY_THRESHOLD } from './activityCapacity.ts';
import { eventLifecycleBadge, isActionableEvent, STARTING_SOON_MINUTES } from './eventLifecyclePresentation.ts';
import { rsvpPresentation, attendanceSummaryKey, attendanceCardKey, attendeePreview } from './eventAttendance.ts';
import { resolveEventLifecycle } from './eventLifecycle.ts';
import { translate } from '@/i18n/core';

// ===========================================================================
// ACTIVITY CAPACITY
// ===========================================================================

test('capacity 8 / attending 5 reads as 3 spots left', () => {
  const result = activityCapacityPresentation({ capacity: 8, attendeeCount: 5 });
  assert.equal(result.key, 'activity.capacity.spotsLeft');
  assert.deepEqual(result.params, { count: 3 });
  assert.equal(result.spotsLeft, 3);
  assert.equal(result.isFull, false);
});

test('capacity 8 / attending 8 reads as Full', () => {
  const result = activityCapacityPresentation({ capacity: 8, attendeeCount: 8 });
  assert.equal(result.key, 'activity.capacity.full');
  assert.equal(result.isFull, true);
  assert.equal(result.spotsLeft, 0);
});

test('the viewer attending takes precedence over spots left', () => {
  const result = activityCapacityPresentation({ capacity: 8, attendeeCount: 5, isAttending: true });
  assert.equal(result.key, 'activity.capacity.youreGoing');
  assert.equal(result.tone, 'joined');
});

test('the viewer attending still reads as going once the activity fills up', () => {
  const result = activityCapacityPresentation({ capacity: 8, attendeeCount: 8, isAttending: true });
  assert.equal(result.key, 'activity.capacity.youreGoing');
  assert.equal(result.isFull, true, 'fullness is still reported to the caller');
});

test('a host is never told there are spots left in their own activity', () => {
  const result = activityCapacityPresentation({ capacity: 8, attendeeCount: 2, isHost: true });
  assert.equal(result.key, 'activity.capacity.hosting');
});

test('NO CAPACITY CONFIGURED: no label is invented', () => {
  for (const capacity of [null, 0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    const result = activityCapacityPresentation({ capacity: capacity as number | null, attendeeCount: 3 });
    assert.equal(result.key, null, `capacity ${capacity} invented a label`);
    assert.equal(result.spotsLeft, null);
    assert.equal(result.isFull, false);
  }
});

test('SPOTS ARE NEVER NEGATIVE, even when attendance exceeds capacity', () => {
  const result = activityCapacityPresentation({ capacity: 5, attendeeCount: 9 });
  assert.equal(result.spotsLeft, 0);
  assert.equal(result.isFull, true);
  assert.equal(result.key, 'activity.capacity.full');
});

test('a negative attendee count cannot produce more spots than capacity', () => {
  const result = activityCapacityPresentation({ capacity: 5, attendeeCount: -3 });
  assert.equal(result.spotsLeft, 5);
});

test('one remaining place uses the singular key', () => {
  assert.equal(activityCapacityPresentation({ capacity: 8, attendeeCount: 7 }).key, 'activity.capacity.oneSpotLeft');
});

test('a nearly-full activity reads as urgent, a roomy one does not', () => {
  assert.equal(activityCapacityPresentation({ capacity: 10, attendeeCount: 8 }).tone, 'urgent');
  assert.equal(activityCapacityPresentation({ capacity: 20, attendeeCount: 2 }).tone, 'neutral');
  assert.equal(LOW_CAPACITY_THRESHOLD, 3);
});

for (const locale of ['en', 'he'] as const) {
  test(`every capacity key renders in ${locale}`, () => {
    for (const key of ['activity.capacity.spotsLeft', 'activity.capacity.oneSpotLeft', 'activity.capacity.full', 'activity.capacity.youreGoing', 'activity.capacity.hosting'] as const) {
      const value = translate(locale, key, { count: 3 });
      assert.notEqual(value, key, `${key} fell through in ${locale}`);
      assert.ok(!value.includes('{'), `${key} left an unfilled placeholder in ${locale}`);
    }
  });
}

// ===========================================================================
// EVENT LIFECYCLE
// ===========================================================================

const NOW = new Date('2026-08-08T12:00:00Z');

test('an event starting within the window reads as STARTING SOON', () => {
  const badge = eventLifecycleBadge('today', '2026-08-08T13:00:00Z', NOW);
  assert.equal(badge.key, 'event.lifecycle.startingSoon');
  assert.equal(badge.tone, 'soon');
});

test('STARTING SOON threshold is exactly 90 minutes and is inclusive at the edge', () => {
  assert.equal(STARTING_SOON_MINUTES, 90);
  const atEdge = eventLifecycleBadge('today', '2026-08-08T13:30:00Z', NOW);
  assert.equal(atEdge.key, 'event.lifecycle.startingSoon');
  const justOutside = eventLifecycleBadge('today', '2026-08-08T13:31:00Z', NOW);
  assert.equal(justOutside.key, 'event.lifecycle.today');
});

test('an event later today is TODAY, not STARTING SOON', () => {
  assert.equal(eventLifecycleBadge('today', '2026-08-08T20:00:00Z', NOW).key, 'event.lifecycle.today');
});

test('a start time already past never claims STARTING SOON', () => {
  // Once the start passes, the resolver owns the state (live/finished).
  assert.equal(eventLifecycleBadge('today', '2026-08-08T11:00:00Z', NOW).key, 'event.lifecycle.today');
});

test('LIVE NOW comes from the resolver and is never overridden', () => {
  const badge = eventLifecycleBadge('live', '2026-08-08T11:30:00Z', NOW);
  assert.equal(badge.key, 'event.lifecycle.live');
  assert.equal(badge.tone, 'live');
});

test('STARTING SOON only ever refines "today" — other states pass through', () => {
  for (const status of ['live', 'upcoming', 'finished', 'cancelled', 'postponed'] as const) {
    const badge = eventLifecycleBadge(status, '2026-08-08T12:30:00Z', NOW);
    assert.notEqual(badge.key, 'event.lifecycle.startingSoon', `${status} was overridden`);
  }
});

test('cancelled, postponed and finished are NOT actionable content', () => {
  for (const status of ['cancelled', 'postponed', 'finished'] as const) {
    assert.equal(isActionableEvent(status), false, status);
    assert.equal(eventLifecycleBadge(status, '2026-08-08T13:00:00Z', NOW).isActive, false);
  }
});

test('live, today and upcoming are actionable', () => {
  for (const status of ['live', 'today', 'upcoming'] as const) {
    assert.equal(isActionableEvent(status), true, status);
  }
});

test('an unparseable start time degrades to TODAY rather than guessing', () => {
  assert.equal(eventLifecycleBadge('today', 'not-a-date', NOW).key, 'event.lifecycle.today');
});

test('REGRESSION: the resolver still owns lifecycle and still validates input', () => {
  // live: now inside [start, end)
  assert.equal(resolveEventLifecycle({
    eventStatus: 'scheduled', occurrenceStatus: 'scheduled',
    startsAt: '2026-08-08T11:00:00Z', endsAt: '2026-08-08T13:00:00Z',
  }, NOW), 'live');
  // A malformed timezone must still fail loudly, on every branch.
  assert.throws(() => resolveEventLifecycle({
    eventStatus: 'scheduled', occurrenceStatus: 'scheduled',
    startsAt: '2026-08-08T11:00:00Z', endsAt: '2026-08-08T13:00:00Z', timezone: 'Not/AZone',
  }, NOW));
});

for (const locale of ['en', 'he'] as const) {
  test(`every lifecycle badge renders in ${locale}`, () => {
    for (const status of ['live', 'today', 'upcoming', 'finished', 'cancelled', 'postponed'] as const) {
      const badge = eventLifecycleBadge(status, '2026-08-08T20:00:00Z', NOW);
      const value = translate(locale, badge.key);
      assert.notEqual(value, badge.key, `${badge.key} fell through in ${locale}`);
    }
    assert.notEqual(translate(locale, 'event.lifecycle.startingSoon'), 'event.lifecycle.startingSoon');
  });
}

// ===========================================================================
// EVENT RSVP
// ===========================================================================

test('an upcoming event offers "I\'m going"', () => {
  const result = rsvpPresentation({ isGoing: false, attendeeCount: 0, lifecycle: 'upcoming' });
  assert.equal(result.key, 'event.rsvp.join');
  assert.equal(result.enabled, true);
  assert.equal(result.selected, false);
});

test('once going, the control reflects the chosen state so it can be undone', () => {
  const result = rsvpPresentation({ isGoing: true, attendeeCount: 3, lifecycle: 'upcoming' });
  assert.equal(result.key, 'event.rsvp.going');
  assert.equal(result.selected, true);
  assert.equal(result.enabled, true, 'must stay tappable so the user can leave');
});

test('RSVP is disabled for cancelled, postponed and finished events', () => {
  for (const lifecycle of ['cancelled', 'postponed', 'finished'] as const) {
    const result = rsvpPresentation({ isGoing: false, attendeeCount: 0, lifecycle });
    assert.equal(result.enabled, false, lifecycle);
    assert.equal(result.key, 'event.rsvp.unavailable');
  }
});

test('PRODUCT RULE: no RSVP copy implies external registration', () => {
  for (const locale of ['en', 'he'] as const) {
    for (const key of ['event.rsvp.join', 'event.rsvp.going'] as const) {
      const value = translate(locale, key).toLowerCase();
      for (const forbidden of ['register', 'ticket', 'digitel', 'municipal', 'הרשמה', 'כרטיס']) {
        assert.ok(!value.includes(forbidden), `${key} (${locale}) implies external registration: "${forbidden}"`);
      }
    }
  }
});

test('external registration is a SEPARATE, differently-labelled action', () => {
  for (const locale of ['en', 'he'] as const) {
    const rsvp = translate(locale, 'event.rsvp.join');
    const external = translate(locale, 'event.registerExternally');
    assert.notEqual(rsvp, external, `${locale}: the two actions must be distinguishable`);
  }
});

test('the disclaimer states plainly that this is not organizer registration', () => {
  assert.match(translate('en', 'event.rsvp.disclaimer'), /does not register you/i);
  assert.ok(translate('he', 'event.rsvp.disclaimer').includes('אינה הרשמה'));
});

// --- Attendance counts -----------------------------------------------------

test('attendance is always attributed to NestUp, never to the event itself', () => {
  for (const locale of ['en', 'he'] as const) {
    const summary = attendanceSummaryKey(7);
    assert.ok(summary);
    const value = translate(locale, summary.key, summary.params);
    assert.ok(value.includes('NestUp'), `${locale}: "${value}" does not say NestUp`);
    assert.ok(value.includes('7'));
  }
});

test('zero attendance renders NOTHING rather than a discouraging "0 going"', () => {
  assert.equal(attendanceSummaryKey(0), null);
  assert.equal(attendanceSummaryKey(-1), null);
  assert.equal(attendanceCardKey(0), null);
});

test('one attendee uses the singular form', () => {
  assert.equal(attendanceSummaryKey(1)?.key, 'event.attendance.oneGoing');
});

test('the card signal is compact and omitted at zero', () => {
  const card = attendanceCardKey(7);
  assert.ok(card);
  const label = translate('en', card.key, card.params);
  assert.equal(label, '7 going');
  assert.ok(label.length < 20, 'card signal must stay compact');
});

// --- Avatar preview --------------------------------------------------------

test('attendee preview shows a few and collapses the rest', () => {
  const attendees = Array.from({ length: 9 }, (_, i) => `u${i}`);
  const preview = attendeePreview(attendees);
  assert.equal(preview.shown.length, 5);
  assert.equal(preview.overflow, 4);
});

test('a short attendee list has no overflow', () => {
  const preview = attendeePreview(['a', 'b']);
  assert.deepEqual(preview.shown, ['a', 'b']);
  assert.equal(preview.overflow, 0);
});

test('an empty attendee list is safe', () => {
  const preview = attendeePreview([]);
  assert.deepEqual(preview.shown, []);
  assert.equal(preview.overflow, 0);
});
