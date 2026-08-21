import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const migration = readFileSync(new URL('../../supabase/migrations/20260821220000_prepare_givatayim_city_provider.sql', import.meta.url), 'utf8');
const edge = readFileSync(new URL('../../supabase/functions/sync-givatayim-events/index.ts', import.meta.url), 'utf8');

test('Givatayim preparation is supervised and keeps city/digest/cron disabled', () => {
  assert.match(migration, /'givatayim'.*false,false/s);
  assert.match(migration, /'givatayim_municipality'.*true,null/s);
  assert.match(migration, /decision_authority.*explicit_operator_instruction/s);
  assert.match(migration, /must remain disabled before controlled sync/);
});
test('Givatayim edge function requires service role and explicit dryRun', () => {
  assert.match(edge, /isServiceRole/);
  assert.match(edge, /DRY_RUN_REQUIRED/);
  assert.match(edge, /runGenericProviderDryRun/);
  assert.match(edge, /cross-city candidates require review/);
});
