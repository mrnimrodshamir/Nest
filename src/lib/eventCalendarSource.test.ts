import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./eventCalendar.ts', import.meta.url), 'utf8');

test('Event calendar uses the Expo 57 legacy implementation, not the throwing root stubs', () => {
  // The root module's getDefaultCalendarAsync/getCalendarsAsync/
  // createEventAsync/requestCalendarPermissionsAsync are deprecation stubs
  // that throw at runtime, which made Add-to-Calendar fail for every Event.
  assert.match(source, /from 'expo-calendar\/legacy'/);
  assert.doesNotMatch(source, /from 'expo-calendar';/);
});

test('the iOS default calendar is only used when it is actually writable', () => {
  // A subscribed holiday calendar or a delegated Google calendar can be the
  // system default, and writing to it fails.
  assert.match(source, /defaultCalendar\.allowsModifications/);
});

test('an unwritable or missing default falls back to scanning for a writable calendar', () => {
  assert.match(source, /getCalendarsAsync\(Calendar\.EntityTypes\.EVENT\)/);
  assert.match(source, /allowsModifications\)\?\.id \?\? null/);
});

test('calendar resolution cannot throw past the {success:false} contract', () => {
  // getDefaultCalendarAsync throws on devices with no default calendar, and
  // enumerating calendars can fail too; both must be contained.
  const body = source.slice(source.indexOf('async function add('));
  const tryIndex = body.indexOf('try {');
  const lookupIndex = body.indexOf('await writableCalendarId()');
  assert.ok(tryIndex >= 0 && lookupIndex >= 0);
  assert.ok(lookupIndex > tryIndex, 'the calendar lookup must sit inside the try block');
});

test('permission denial returns an error rather than throwing', () => {
  assert.match(source, /status !== 'granted'/);
  assert.match(source, /success: false/);
});

test('repeat taps cannot create duplicate calendar entries', () => {
  // Both guards matter: the in-flight map coalesces rapid double taps, and the
  // stored id short-circuits taps in a later session.
  assert.match(source, /inFlight/);
  assert.match(source, /if \(existing\) return \{ success: true \}/);
});

test('events are written with an explicit timezone, not the device default', () => {
  assert.match(source, /timeZone: 'Asia\/Jerusalem'/);
});
