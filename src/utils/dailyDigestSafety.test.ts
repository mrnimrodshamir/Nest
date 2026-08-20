import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../../supabase/migrations/20260819220000_daily_digest_schema.sql', import.meta.url), 'utf8');
const app = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
const handler = readFileSync(new URL('../../supabase/functions/send-daily-digest/handler.ts', import.meta.url), 'utf8');
const cronReview = readFileSync(new URL('../../docs/daily-digest/production-enablement.md', import.meta.url), 'utf8');

test('digest delivery tables are RLS-closed and logically unique', () => {
  for (const table of ['daily_digest_instances', 'daily_digest_sends']) {
    assert.match(migration, new RegExp(`alter table public\\.${table} enable row level security`));
    assert.match(migration, new RegExp(`revoke all on public\\.${table} from anon, authenticated`));
  }
  assert.match(migration, /unique \(user_id, digest_type, digest_date\)/);
  assert.match(migration, /status in \('claimed', 'sent', 'failed'\)/);
  assert.match(migration, /jsonb_build_object\('daily_digest', false\)/);
});

test('delivery claims happen before the push sender and dry runs suppress writes', () => {
  assert.ok(handler.indexOf('database.claimSend') < handler.indexOf('pushSender.send'));
  assert.match(handler, /input\.dryRun[\s\S]*database\.trackAnalytics\.bind/);
  assert.match(handler, /removeInvalidPushToken/);
});

test('cold-start routing retains a pending digest until navigation is ready', () => {
  assert.match(app, /pendingDailyDigestRoute/);
  assert.match(app, /navigatePendingDailyDigest/);
  assert.match(app, /getLastNotificationResponseAsync/);
  assert.match(app, /clearLastNotificationResponseAsync/);
  assert.match(app, /requestedDate=\{route\.params\?\.date\}/);
});

test('cron is review-only and never applied by a tracked migration', () => {
  assert.match(cronReview, /\*\/15 \* \* \* \*/);
  assert.match(cronReview, /"dryRun":false/);
  assert.match(cronReview, /Do not run this SQL/);
  assert.doesNotMatch(migration, /cron\.schedule/);
});
