import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const migrationUrl = new URL('../../supabase/migrations/0005_normalized_activity_locations.sql', import.meta.url);

test('location migration is additive, nullable, constrained, and reversible', async () => {
  const sql = await readFile(migrationUrl, 'utf8');
  for (const column of ['place_name', 'formatted_address', 'place_category', 'place_provider', 'provider_place_id', 'location_source', 'location_was_adjusted']) {
    assert.match(sql, new RegExp(`add column if not exists ${column}`));
    assert.match(sql, new RegExp(`drop column if exists ${column}`));
  }
  assert.match(sql, /place_provider in \('apple_maps'\)/);
  assert.match(sql, /location_source in \('provider', 'manual', 'legacy'\)/);
  assert.doesNotMatch(sql, /drop column if exists address_label/);
  assert.doesNotMatch(sql, /alter column (latitude|longitude)/);
});

test('migration prepares a shared authenticated 30-per-minute limiter', async () => {
  const sql = await readFile(migrationUrl, 'utf8');
  assert.match(sql, /create table if not exists public\.place_search_rate_limits/);
  assert.match(sql, /auth\.uid\(\)/);
  assert.match(sql, /request_count <= 30/);
  assert.match(sql, /grant execute on function public\.consume_place_search_rate_limit\(\) to authenticated/);
  assert.match(sql, /revoke all on table public\.place_search_rate_limits from anon, authenticated/);
});

