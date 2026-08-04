import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  groupAttendance,
  buildWithLabel,
  formatAttendanceAge,
  resolveParticipantCounts,
  type AttendanceRow,
} from './attendanceSummary.ts';

function row(over: Partial<AttendanceRow> = {}): AttendanceRow {
  return {
    source: 'attendee',
    user_id: 'u1',
    display_name: 'Daniel',
    avatar_url: null,
    coming_alone: false,
    child_id: 'c1',
    child_name: 'Maya',
    child_age_months: 14,
    ...over,
  };
}

// ---------------------------------------------------------------------
// PRIVACY — the P0 guarantee
// ---------------------------------------------------------------------

test('PRIVACY: the row contract has no birthdate field at all', () => {
  const keys = Object.keys(row());
  assert.ok(!keys.some((k) => /birth|dob|date/i.test(k)), `unexpected date-like key in ${keys}`);
});

test('PRIVACY: no grouped output value is a date-like string', () => {
  const people = groupAttendance([row(), row({ user_id: 'u2', child_name: 'Noa' })]);
  const serialized = JSON.stringify(people);
  // ISO date, slash date and dotted date forms must not appear anywhere.
  assert.ok(!/\d{4}-\d{2}-\d{2}/.test(serialized), 'ISO date leaked into output');
  assert.ok(!/\d{1,2}\/\d{1,2}\/\d{2,4}/.test(serialized), 'slash date leaked into output');
  assert.ok(!/\d{1,2}\.\d{1,2}\.\d{2,4}/.test(serialized), 'dotted date leaked into output');
});

test('PRIVACY: a missing age degrades to a name-only label, never a raw value', () => {
  const people = groupAttendance([row({ child_age_months: null })]);
  assert.equal(people[0].summary, 'coming with Maya');
});

test('attendance age formatting uses months under 24 and years from 24 months', () => {
  assert.equal(formatAttendanceAge(0), 'Newborn');
  assert.equal(formatAttendanceAge(8), '8mo');
  assert.equal(formatAttendanceAge(23), '23mo');
  assert.equal(formatAttendanceAge(24), '2y');
  assert.equal(formatAttendanceAge(36), '3y');
  assert.equal(formatAttendanceAge(null), null);
});

// ---------------------------------------------------------------------
// Host
// ---------------------------------------------------------------------

test('host with a child is listed first and labelled With <name>', () => {
  const people = groupAttendance([
    row({ source: 'attendee', user_id: 'u2', display_name: 'Daniel' }),
    row({ source: 'host', user_id: 'h1', display_name: 'Nimrod', child_name: 'Go' }),
  ]);
  assert.equal(people[0].displayName, 'Nimrod');
  assert.equal(people[0].isHost, true);
  assert.equal(people[0].withLabel, 'With Go');
});

test('host coming alone', () => {
  const people = groupAttendance([
    row({ source: 'host', user_id: 'h1', coming_alone: true, child_id: null, child_name: null }),
  ]);
  assert.equal(people[0].isHost, true);
  assert.equal(people[0].withLabel, 'Coming alone');
});

test('host with multiple children stays one host row and shows every selected child', () => {
  const people = groupAttendance([
    row({ source: 'host', user_id: 'h1', child_id: 'c1', child_name: 'Go' }),
    row({ source: 'host', user_id: 'h1', child_id: 'c2', child_name: 'Yo' }),
  ]);
  assert.equal(people.length, 1);
  assert.equal(people[0].withLabel, 'With Go and Yo');
});

// ---------------------------------------------------------------------
// Participants
// ---------------------------------------------------------------------

test('participant with one child', () => {
  const people = groupAttendance([row()]);
  assert.equal(people.length, 1);
  assert.deepEqual(people[0].childNames, ['Maya']);
  assert.equal(people[0].withLabel, 'With Maya');
});

test('participant with multiple children collapses to ONE person row', () => {
  const people = groupAttendance([
    row({ child_id: 'c1', child_name: 'Maya' }),
    row({ child_id: 'c2', child_name: 'Noa' }),
  ]);
  assert.equal(people.length, 1, 'must not produce a row per child');
  assert.deepEqual(people[0].childNames, ['Maya', 'Noa']);
  assert.equal(people[0].withLabel, 'With Maya and Noa');
});

test('participant with three children', () => {
  const people = groupAttendance([
    row({ child_id: 'c1', child_name: 'Go' }),
    row({ child_id: 'c2', child_name: 'Yo' }),
    row({ child_id: 'c3', child_name: 'Zo' }),
  ]);
  assert.equal(people[0].withLabel, 'With Go, Yo and Zo');
});

test('participant coming alone', () => {
  const people = groupAttendance([
    row({ coming_alone: true, child_id: null, child_name: null }),
  ]);
  assert.equal(people[0].withLabel, 'Coming alone');
  assert.deepEqual(people[0].childNames, []);
});

test('missing child data degrades to Coming alone without dropping the caregiver', () => {
  const people = groupAttendance([row({ child_id: null, child_name: null, child_age_months: null })]);
  assert.equal(people.length, 1);
  assert.equal(people[0].withLabel, 'Coming alone');
});

test('missing avatar is retained as null for the PersonCard initial fallback', () => {
  const people = groupAttendance([row({ avatar_url: null })]);
  assert.equal(people[0].avatarUrl, null);
});

test('duplicate attendance rows for the same child do not duplicate the name', () => {
  const people = groupAttendance([row(), row()]);
  assert.equal(people.length, 1);
  assert.deepEqual(people[0].childNames, ['Maya']);
});

test('zero joined participants — host only', () => {
  const people = groupAttendance([
    row({ source: 'host', user_id: 'h1', display_name: 'Nimrod', child_name: 'Go' }),
  ]);
  assert.equal(people.length, 1);
  assert.equal(people[0].isHost, true);
});

test('a participant who left is simply absent from the rows', () => {
  const before = groupAttendance([
    row({ source: 'host', user_id: 'h1' }),
    row({ user_id: 'u2', display_name: 'Sarah' }),
  ]);
  assert.equal(before.length, 2);
  const after = groupAttendance([row({ source: 'host', user_id: 'h1' })]);
  assert.equal(after.length, 1);
});

test('empty attendance does not crash', () => {
  assert.deepEqual(groupAttendance([]), []);
});

// ---------------------------------------------------------------------
// Counts
// ---------------------------------------------------------------------

test('counts: 4 of 8 leaves 4 spots', () => {
  const people = ['a', 'b', 'c', 'd'].map((id) => groupAttendance([row({ user_id: id })])[0]);
  const counts = resolveParticipantCounts(people, 8);
  assert.equal(counts.count, 4);
  assert.equal(counts.capacity, 8);
  assert.equal(counts.spotsLeft, 4);
});

test('counts: uncapped capacity reports null spots, never a number', () => {
  const counts = resolveParticipantCounts([groupAttendance([row()])[0]], null);
  assert.equal(counts.capacity, null);
  assert.equal(counts.spotsLeft, null);
});

test('counts: over-subscription never reports negative spots', () => {
  const people = ['a', 'b', 'c'].map((id) => groupAttendance([row({ user_id: id })])[0]);
  assert.equal(resolveParticipantCounts(people, 2).spotsLeft, 0);
});

test('buildWithLabel is pure and locale-independent', () => {
  assert.equal(buildWithLabel(true, ['Go']), 'Coming alone');
  assert.equal(buildWithLabel(false, []), 'Coming alone');
  assert.equal(buildWithLabel(false, ['Go']), 'With Go');
});
