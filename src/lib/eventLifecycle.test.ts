import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** Lifecycle exclusion for provider Events.
 *
 *  These assert the SHAPE of the read path, because the defect being guarded
 *  against is not "finished events are shown" — they never were — but "finished
 *  events consume the row budget before the filter runs", which no amount of
 *  client-side filtering can fix.
 */
const events = readFileSync(new URL('./events.ts', import.meta.url), 'utf8');

test('Discovery reads the active view, not the raw events table', () => {
  assert.match(events, /ACTIVE_EVENTS_VIEW = 'active_event_occurrences'/);
  assert.match(events, /from\(ACTIVE_EVENTS_VIEW\)/);
});

test('REGRESSION: the row limit is applied AFTER lifecycle filtering, not before', () => {
  // The old shape selected up to 200 events by viewport and only then dropped
  // the finished ones. A catalogue with more dead events than the limit would
  // return an empty Discovery from a full table. The filter has to live in the
  // database, ahead of the limit.
  const discovery = events.slice(events.indexOf('export async function queryDiscoveryEvents'), events.indexOf('export async function queryEventsAtPlace'));
  assert.ok(!/\.from\('events'\)/.test(discovery), 'Discovery queries the raw events table again');
  assert.match(discovery, /\.limit\(DISCOVERY_EVENT_LIMIT\)/);
});

test('both Discovery and Place surfaces use the same active source', () => {
  const placeQuery = events.slice(events.indexOf('export async function queryEventsAtPlace'));
  assert.match(placeQuery, /from\(ACTIVE_EVENTS_VIEW\)/);
});

test('the client keeps a finished-lifecycle guard against clock skew', () => {
  // The view filters on the DATABASE clock. A device whose clock is ahead could
  // otherwise surface an event that has just ended.
  assert.match(events, /details\.lifecycle === 'finished' \? \[\] : \[details\]/);
});

test('event detail lookup still resolves a single occurrence directly', () => {
  // Deep links to a finished event must still load — the lifecycle badge tells
  // the user it is over. Only the browsing surfaces exclude it.
  const detail = events.slice(events.indexOf('export async function getEventDetails'));
  assert.match(detail, /from\('event_occurrences'\)/);
  assert.ok(!/active_event_occurrences/.test(detail), 'detail view must not hide finished events');
});
