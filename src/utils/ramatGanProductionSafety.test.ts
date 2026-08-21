import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../../supabase/migrations/20260821210000_enable_ramat_gan_city_foundation.sql', import.meta.url), 'utf8');
const digestBackend = readFileSync(new URL('../../supabase/functions/send-daily-digest/index.ts', import.meta.url), 'utf8');
const digestClient = readFileSync(new URL('../lib/events.ts', import.meta.url), 'utf8');
const eventProviderMigration = readFileSync(new URL('../../supabase/migrations/20260821212600_register_beit_emanuel_event_provider.sql', import.meta.url), 'utf8');
const productionMigration = readFileSync(new URL('../../supabase/migrations/20260821212700_enable_ramat_gan_production.sql', import.meta.url), 'utf8');
const scheduleMigration = readFileSync(new URL('../../supabase/migrations/20260821212800_schedule_beit_emanuel_sync.sql', import.meta.url), 'utf8');

test('Ramat Gan migration is additive, city-tagged, Level 2, and digest-disabled', () => {
  assert.match(migration, /add column if not exists city_id/);
  assert.match(migration, /'ramat_gan'.*false,false/s);
  assert.match(migration, /autonomy_level smallint not null default 2/);
  assert.doesNotMatch(migration, /delete from public\.(events|places|activities)/i);
});

test('Daily and Weekly digest candidate paths explicitly remain Tel Aviv-only', () => {
  assert.match(digestBackend, /\.eq\('city_id', 'tel_aviv'\)/);
  assert.equal((digestClient.match(/\.eq\('city_id', 'tel_aviv'\)/g) ?? []).length, 2);
});

test('internal control plane remains private while enabled city config is readable', () => {
  assert.match(migration, /city_registry_read_enabled/);
  assert.doesNotMatch(migration, /grant select on public\.(city_expansion_runs|agent_tasks|agent_artifacts|agent_decisions|approval_requests) to (anon|authenticated)/i);
});

test('Beit Emanuel is registered in the legacy event provider FK registry', () => {
  assert.match(eventProviderMigration, /insert into public\.event_providers/);
  assert.match(eventProviderMigration, /'ramat_gan_beit_emanuel'/);
  assert.doesNotMatch(eventProviderMigration, /delete from public\.events/i);
});

test('production enablement remains Level 2 and keeps Ramat Gan digests disabled', () => {
  assert.match(productionMigration, /enabled=true, digest_enabled=false, autonomy_level=2/);
  assert.match(productionMigration, /current_stage='production_enabled'/);
  assert.doesNotMatch(productionMigration, /delete from public\.(events|places|event_attendees)/i);
});

test('Beit Emanuel has one explicit 12-hour fail-closed scheduler path', () => {
  assert.equal((scheduleMigration.match(/cron\.schedule\(/g) ?? []).length, 1);
  assert.match(scheduleMigration, /sync-beit-emanuel-events-every-12-hours/);
  assert.match(scheduleMigration, /'43 \*\/12 \* \* \*'/);
  assert.match(scheduleMigration, /body := '\{"dryRun":false\}'::jsonb/);
});
