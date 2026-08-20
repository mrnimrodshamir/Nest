import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const weeklyMigration = readFileSync(new URL('../../supabase/migrations/20260820220000_weekly_digest_schema.sql', import.meta.url), 'utf8');
const dailySchedule = readFileSync(new URL('../../supabase/migrations/20260820210000_schedule_daily_digest.sql', import.meta.url), 'utf8');
const weeklySchedule = readFileSync(new URL('../../docs/weekly-digest/production-enablement.sql', import.meta.url), 'utf8');
const digestSchema = readFileSync(new URL('../../supabase/migrations/20260819220000_daily_digest_schema.sql', import.meta.url), 'utf8');
const edgeIndex = readFileSync(new URL('../../supabase/functions/send-daily-digest/index.ts', import.meta.url), 'utf8');
const app = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');

test('Weekly preference is independent, explicit, and defaults existing users off', () => {
  assert.match(weeklyMigration, /jsonb_build_object\('weekly_digest', false\)/);
  assert.match(edgeIndex, /weekly_digest' : 'daily_digest/);
  assert.match(edgeIndex, /notification_preferences->>/);
  assert.doesNotMatch(weeklyMigration, /'daily_digest', false/);
});

test('Daily production scheduler remains byte-for-byte type-specific', () => {
  assert.match(dailySchedule, /send-daily-digest-jerusalem-0700/);
  assert.match(dailySchedule, /body := '\{"dryRun":false\}'/);
  assert.doesNotMatch(dailySchedule, /weekly/);
});

test('Weekly scheduler is prepared but not tracked as an enabling migration', () => {
  assert.match(weeklySchedule, /send-weekly-digest-jerusalem-1900/);
  assert.match(weeklySchedule, /"digestType":"weekly"/);
  assert.doesNotMatch(weeklySchedule, /"force":true/);
  assert.equal((weeklySchedule.match(/perform cron\.schedule\(/g) ?? []).length, 1);
  assert.doesNotMatch(weeklyMigration, /cron\.schedule/);
});

test('publication-safe source excludes hidden, unpublished, cancelled, archived, and finished rows', () => {
  for (const predicate of [
    /publication_status = 'published'/,
    /verification_status = 'verified'/,
    /e\.is_visible/,
    /occurrence_status is distinct from 'cancelled'/,
    /event_status is distinct from 'cancelled'/,
    /o\.archived_at is null/,
    /coalesce\(o\.ends_at, o\.starts_at\) >= now\(\)/,
  ]) assert.match(digestSchema, predicate);
});

test('weekly cold/warm navigation has a dedicated route and safe fallback', () => {
  assert.match(app, /digestIntentController\.capture/);
  assert.match(app, /pending\.kind === 'weekly'/);
  assert.match(app, /navigationRef\.navigate\('WeeklyDigest'/);
  assert.match(app, /pending\.kind === 'fallback'/);
  assert.match(app, /navigationRef\.navigate\('Tabs'\)/);
  assert.match(app, /mainNavigatorReady/);
  assert.match(app, /digestRoutesAreRegistered/);
});
