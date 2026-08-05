import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const sql = await readFile(new URL('../../supabase/migrations/0009_events_domain.sql', import.meta.url), 'utf8');

test('Events migration keeps events separate from activities and models occurrences', () => {
  assert.match(sql, /create table if not exists public\.events/i);
  assert.match(sql, /create table if not exists public\.event_occurrences/i);
  assert.doesNotMatch(sql, /alter table public\.activities/i);
  assert.match(sql, /event_id uuid not null references public\.events\(id\) on delete cascade/i);
});

test('Events migration includes lifecycle, recurrence, source, provider, and deduplication fields', () => {
  for (const field of [
    'event_status', 'occurrence_status', 'cancellation_reason', 'provider_event_id',
    'provider_transport_id', 'source_group_id', 'provider_metadata', 'is_recurring',
    'recurrence_rule', 'recurrence_timezone', 'recurrence_series_id', 'occurrence_fingerprint',
    'deduplication_key',
  ]) assert.match(sql, new RegExp(`\\b${field}\\b`, 'i'));
});

test('Events remain staged by default and writes are unavailable to mobile roles', () => {
  assert.match(sql, /publication_status text not null default 'staged'/i);
  assert.match(sql, /verification_status text not null default 'staged'/i);
  assert.match(sql, /revoke insert, update, delete on public\.events, public\.event_occurrences from anon, authenticated/i);
  assert.match(sql, /publication_status = 'published' and verification_status = 'verified'/i);
});

test('Events migration has review-only rollback SQL', () => {
  assert.match(sql, /-- ROLLBACK \(review and run manually/i);
  assert.match(sql, /-- drop table if exists public\.event_occurrences/i);
  assert.match(sql, /-- drop table if exists public\.events/i);
});
