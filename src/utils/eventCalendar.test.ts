import assert from 'node:assert/strict';
import test from 'node:test';
import { buildGoogleEventCalendarUrl, eventCalendarNotes, validateCalendarEvent, type CalendarEventInfo } from '@/utils/eventCalendar';

const event = (overrides: Partial<CalendarEventInfo> = {}): CalendarEventInfo => ({
  occurrenceId: 'occurrence-1',
  title: 'Story time',
  description: 'Official library event',
  startsAt: '2026-08-06T14:00:00.000Z',
  endsAt: '2026-08-06T15:00:00.000Z',
  locationName: 'Beit Ariela',
  sourceUrl: 'https://example.org/event',
  status: 'scheduled',
  ...overrides,
});

test('Google Event calendar export contains exact times, timezone, venue, source, and deep link', () => {
  const url = new URL(buildGoogleEventCalendarUrl(event())!);
  assert.equal(url.searchParams.get('dates'), '20260806T140000Z/20260806T150000Z');
  assert.equal(url.searchParams.get('ctz'), 'Asia/Jerusalem');
  assert.equal(url.searchParams.get('location'), 'Beit Ariela');
  assert.match(url.searchParams.get('details')!, /https:\/\/example\.org\/event/);
  assert.match(url.searchParams.get('details')!, /nestup:\/\/event\/occurrence-1/);
});

test('missing or invalid end time is rejected rather than invented', () => {
  assert.match(validateCalendarEvent(event({ endsAt: null }))!, /confirmed end time/);
  assert.equal(buildGoogleEventCalendarUrl(event({ endsAt: null })), null);
  assert.match(validateCalendarEvent(event({ endsAt: '2026-08-06T13:00:00Z' }))!, /confirmed end time/);
});

test('cancelled and postponed events are blocked with a clear warning', () => {
  assert.match(validateCalendarEvent(event({ status: 'cancelled' }))!, /Cancelled/);
  assert.match(validateCalendarEvent(event({ status: 'postponed' }))!, /confirmed new time/);
});

test('calendar notes do not duplicate source or deep-link lines', () => {
  const notes = eventCalendarNotes(event());
  assert.equal(notes.match(/example\.org/g)?.length, 1);
  assert.equal(notes.match(/nestup:\/\/event/g)?.length, 1);
});
