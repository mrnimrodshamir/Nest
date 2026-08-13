import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { translate, type AppLocale } from '@/i18n/core';
import { attendanceCardKey, attendanceSummaryKey, attendeePreview } from '@/utils/eventAttendance';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const hook = read('../hooks/useEventRsvp.ts');
const details = read('../screens/EventDetailsScreen.tsx');
const sheet = read('../components/EventAttendeesSheet.tsx');
const eventCard = read('../components/EventCard.tsx');
const discovery = read('../screens/DiscoverScreen.tsx');
const discoveryHook = read('../hooks/useDiscoveryEvents.ts');
const migration = read('../../supabase/migrations/0015_event_attendees.sql');
const syncMigration = read('../../supabase/migrations/20260814120000_digitel_sync_executor.sql');

test('RSVP and un-RSVP use the existing authenticated, idempotent relationship', () => {
  assert.match(hook, /\.upsert\(/);
  assert.match(hook, /onConflict: 'event_occurrence_id,user_id'/);
  assert.match(hook, /\.delete\(\)/);
  assert.match(hook, /\.eq\('user_id', viewerId\)/);
  assert.match(hook, /supabase\.auth\.getUser\(\)/);
  assert.match(migration, /unique \(event_occurrence_id, user_id\)/);
  assert.match(migration, /with check \(user_id = \(select auth\.uid\(\)\)\)/);
  assert.match(migration, /using \(user_id = \(select auth\.uid\(\)\)\)/);
});

test('count is based on attendance rows even if a public profile cannot be loaded', () => {
  assert.match(hook, /setAttendeeCount\(userIds\.length\)/);
  assert.match(hook, /attendeeCount,/);
});

test('zero is hidden and Details previews no more than five avatars', () => {
  assert.equal(attendanceSummaryKey(0), null);
  assert.equal(attendanceCardKey(0), null);
  assert.deepEqual(attendeePreview(Array.from({ length: 8 }, (_, index) => index)), { shown: [0, 1, 2, 3, 4], overflow: 3 });
  assert.match(details, /attendanceSummary \?/);
});

test("attendee count and avatar group open the lightweight Who's going list", () => {
  assert.match(details, /setShowAttendees\(true\)/);
  assert.match(details, /<EventAttendeesSheet/);
  assert.match(sheet, /attendees\.map/);
  assert.match(sheet, /ageYears/);
  assert.match(sheet, /parentRoleKey/);
  assert.match(sheet, /childCount/);
  assert.match(sheet, /neighborhood/);
});

test('attendee list opens the existing Public Profile route', () => {
  assert.match(sheet, /onOpenProfile\(attendee\.userId\)/);
  assert.match(details, /onOpenProfile=\{onOpenProfile\}/);
});

test('attendee query exposes only approved public-profile fields', () => {
  const executable = hook.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const field of ['display_name', 'avatar_url', 'age_years', 'parent_role', 'child_count', 'neighborhood_label']) {
    assert.match(executable, new RegExp(field));
  }
  for (const forbidden of ['email', 'phone', 'birthdate', 'latitude', 'longitude', 'formatted_address']) {
    assert.ok(!new RegExp(`\\b${forbidden}\\b`).test(executable), forbidden);
  }
});

test('external registration remains a distinct action below NestUp RSVP', () => {
  assert.ok(details.indexOf('event.rsvp.disclaimer') < details.indexOf('content.registrationLabel'));
  for (const locale of ['en', 'he', 'fr', 'ru'] as AppLocale[]) {
    assert.notEqual(translate(locale, 'event.rsvp.join'), translate(locale, 'event.registerExternally'));
    assert.ok(translate(locale, 'event.rsvp.disclaimer').length > 20);
  }
});

test('DigiTel cleanup cannot delete an RSVP-linked occurrence', () => {
  assert.match(syncMigration, /exists \(select 1 from public\.event_attendees attendee where attendee\.event_occurrence_id = occurrence\.id\)/);
  assert.match(syncMigration, /not exists \(select 1 from public\.event_attendees attendee where attendee\.event_occurrence_id = occurrence\.id\)/);
});

test('Discovery receives a compact count without loading attendee profiles in EventCard', () => {
  assert.match(discovery, /eventsQuery\.attendeeCounts\[item\.data\.occurrence\.id\]/);
  assert.match(eventCard, /attendanceCardKey\(attendeeCount\)/);
  assert.ok(!/public_profiles|useEventRsvp/.test(eventCard));
  assert.match(discoveryHook, /Attendance is a secondary social signal/);
  assert.match(discoveryHook, /catch \{\s*if \(id === requestId\.current\) setAttendeeCounts\(\{\}\)/);
});

test('EN HE FR RU attendance copy is complete and identifies NestUp', () => {
  for (const locale of ['en', 'he', 'fr', 'ru'] as AppLocale[]) {
    for (const key of ['event.rsvp.join', 'event.rsvp.going', 'event.attendance.going', 'event.attendance.title', 'event.attendance.openList', 'event.attendance.openProfile'] as const) {
      const value = translate(locale, key, { count: 8, name: 'Daniel' });
      assert.notEqual(value, key, `${locale} ${key}`);
      assert.ok(!value.includes('{'), `${locale} ${key}`);
    }
    assert.ok(translate(locale, 'event.attendance.going', { count: 8 }).includes('NestUp'));
  }
});
