import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../../supabase/migrations/20260822230000_weekend_digest_schema.sql', import.meta.url), 'utf8');
const schedule = readFileSync(new URL('../../docs/weekend-digest/production-enablement.sql', import.meta.url), 'utf8');
const index = readFileSync(new URL('../../supabase/functions/send-daily-digest/index.ts', import.meta.url), 'utf8');
const screen = readFileSync(new URL('../screens/WeekendDigestScreen.tsx', import.meta.url), 'utf8');
const app = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');

test('Weekend extends the existing Digest schema and defaults existing users off', () => {
  assert.match(migration, /jsonb_build_object\('weekend_digest', false\)/);
  assert.match(migration, /digest_type in \('daily', 'weekly', 'weekend'\)/);
  assert.doesNotMatch(migration, /create table/i);
});

test('Weekend cron is prepared but not a tracked migration and retains shared function', () => {
  assert.match(schedule, /send-weekend-digest-jerusalem-1800/);
  assert.match(schedule, /'\*\/15 \* \* \* \*'/);
  assert.match(schedule, /send-daily-digest/);
  assert.match(schedule, /"digestType":"weekend"/);
});

test('manual force cannot broadcast without an explicit controlled test user', () => {
  assert.match(index, /body\.force === true && body\.dryRun === false && !body\.testUserId/);
  assert.match(index, /CONTROLLED_TEST_USER_REQUIRED/);
  assert.match(index, /query = query\.eq\('id', testUserId\)/);
});

test('Weekend modal preserves Event back stack and X-only close behavior', () => {
  assert.match(screen, /onOpenEvent\(event\.occurrence\.id\)/);
  assert.match(screen, /weekend_digest_closed/);
  assert.match(app, /name="WeekendDigest" options=\{\{ presentation: 'modal' \}\}/);
  assert.match(app, /onOpenEvent=\{\(occurrenceId\) => navigation\.navigate\('EventDetails'/);
  assert.match(app, /requestedWeekendStart/);
});
