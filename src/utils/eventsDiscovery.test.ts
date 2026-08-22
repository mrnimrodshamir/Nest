import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { MOCK_EVENTS } from '@/mocks/mockEvents';
import type { EventDetails, EventLifecycleStatus } from '@/types/event';
import { groupPlaceEvents } from '@/utils/placeEvents';

function event(id: string, lifecycle: EventLifecycleStatus, startsAt: string): EventDetails {
  return {
    ...MOCK_EVENTS[0],
    id: `event-${id}`,
    lifecycle,
    occurrence: { ...MOCK_EVENTS[0].occurrence, id, eventId: `event-${id}`, startsAt },
  };
}

test('Place Details groups linked Events into Today Here and Upcoming Here', () => {
  const groups = groupPlaceEvents([
    event('upcoming-late', 'upcoming', '2026-08-08T10:00:00Z'),
    event('live', 'live', '2026-08-05T10:00:00Z'),
    event('today', 'today', '2026-08-05T12:00:00Z'),
    event('upcoming-early', 'upcoming', '2026-08-06T10:00:00Z'),
    event('postponed', 'postponed', '2026-08-07T10:00:00Z'),
  ]);
  assert.deepEqual(groups.today.map((item) => item.occurrence.id), ['live', 'today']);
  assert.deepEqual(groups.upcoming.map((item) => item.occurrence.id), ['upcoming-early', 'postponed', 'upcoming-late']);
});

test('cancelled and finished Events do not appear in place event sections', () => {
  const groups = groupPlaceEvents([
    event('cancelled', 'cancelled', '2026-08-05T10:00:00Z'),
    event('finished', 'finished', '2026-08-05T09:00:00Z'),
  ]);
  assert.deepEqual(groups, { today: [], upcoming: [] });
});

test('Event query is occurrence-backed, viewport-limited, staged-domain-only, and has no recommendation logic', async () => {
  const source = await readFile(new URL('../lib/events.ts', import.meta.url), 'utf8');
  assert.match(source, /from\('events'\)/);
  assert.match(source, /from\('event_occurrences'\)/);
  assert.match(source, /publication_status', 'published'/);
  assert.match(source, /verification_status', 'verified'/);
  assert.match(source, /DISCOVERY_EVENT_LIMIT = 200/);
  // Discovery's date relevance horizon now lives in
  // src/utils/discoveryDateFilter.ts (a 30-day default, extendable via an
  // explicit date filter) rather than a fixed 90-day cutoff baked into the
  // query itself — see discoveryDateFilter.test.ts for that logic's coverage.
  assert.match(source, /resolveDiscoveryDateRange/);
  assert.doesNotMatch(source, /recommend|personaliz|\bai\b|saved/i);
});

test('Discovery defaults to a 30-day date-relevance horizon, not the Place Details 90-day one', async () => {
  const source = await readFile(new URL('../utils/discoveryDateFilter.ts', import.meta.url), 'utf8');
  assert.match(source, /DISCOVERY_DEFAULT_HORIZON_DAYS = 30/);
});

test('Event marker, card, details route, and place integration are present without a Saved control', async () => {
  const marker = await readFile(new URL('../components/EventMapPin.tsx', import.meta.url), 'utf8');
  const card = await readFile(new URL('../components/EventCard.tsx', import.meta.url), 'utf8');
  const placeDetails = await readFile(new URL('../screens/PlaceDetailsScreen.tsx', import.meta.url), 'utf8');
  const app = await readFile(new URL('../../App.tsx', import.meta.url), 'utf8');
  assert.match(marker, /rotate: '45deg'/);
  assert.match(marker, /accessibilityLabel=\{t\('map\.eventMarker'/);
  assert.match(card, /EventCard/);
  assert.match(app, /EventDetails: \{ occurrenceId: string \}/);
  assert.match(app, /event\/:occurrenceId/);
  // Now rendered through i18n, so the assertion follows the KEY rather than
  // the English string — the copy itself is covered by the dictionary tests.
  assert.match(placeDetails, /t\('place\.todayHere'\)/);
  assert.match(placeDetails, /t\('place\.upcomingHere'\)/);
  assert.doesNotMatch(`${marker}\n${card}\n${placeDetails}`, /recommend|personaliz|\bai\b|saved/i);
});
