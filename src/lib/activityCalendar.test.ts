import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildGoogleCalendarUrl } from '../utils/buildGoogleCalendarUrl.ts';

function activityInfo(overrides) {
  return {
    id: 'activity-1',
    title: 'Morning stroller walk',
    description: 'Bring water',
    startsAt: new Date(Date.UTC(2026, 6, 31, 10, 0, 0)),
    durationMinutes: 90,
    locationName: 'HaYarkon Park',
    ...overrides,
  };
}

test('buildGoogleCalendarUrl: encodes start/end as UTC Google-format timestamps', () => {
  const url = buildGoogleCalendarUrl(activityInfo({}));
  const params = new URL(url).searchParams;
  // 10:00 UTC start, 90 min duration -> 11:30 UTC end.
  assert.equal(params.get('dates'), '20260731T100000Z/20260731T113000Z');
});

test('buildGoogleCalendarUrl: end time correctly derives from duration, including an hour rollover', () => {
  const url = buildGoogleCalendarUrl(activityInfo({ startsAt: new Date(Date.UTC(2026, 6, 31, 23, 15, 0)), durationMinutes: 60 }));
  const params = new URL(url).searchParams;
  assert.equal(params.get('dates'), '20260731T231500Z/20260801T001500Z');
});

test('buildGoogleCalendarUrl: title, location, and deep link all present', () => {
  const url = buildGoogleCalendarUrl(activityInfo({}));
  const params = new URL(url).searchParams;
  assert.equal(params.get('text'), 'Morning stroller walk');
  assert.equal(params.get('location'), 'HaYarkon Park');
  assert.ok(params.get('details').includes('nestup://activity/activity-1'));
  assert.equal(params.get('action'), 'TEMPLATE');
});

test('buildGoogleCalendarUrl: points at the real Google Calendar render endpoint', () => {
  const url = buildGoogleCalendarUrl(activityInfo({}));
  assert.ok(url.startsWith('https://calendar.google.com/calendar/render?'));
});
