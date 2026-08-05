import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { DigitelEventCandidate } from '@/integrations/digitelConnector';
import { curateDigitelActivation, SPRINT9_PASS_TRANSPORT_IDS } from '@/integrations/digitelActivation';
import { buildActivationImportSql } from '@/integrations/eventActivationSql';

function candidate(id: string, overrides: Partial<DigitelEventCandidate> = {}): DigitelEventCandidate {
  return {
    provider: 'tel_aviv_digitel', providerEventId: `digitel-v1-${id.padStart(16, '0')}`,
    providerTransportId: id, sourceGroupId: '10', title: `סדנת ילדים ${id}`, description: 'פעילות משפחתית מאומתת',
    sourceType: 'אירועים בתוקף', sourceUrl: `https://www.tel-aviv.gov.il/event/${id}`,
    startTime: '2026-09-01T10:00:00.000Z', endTime: null, recurring: null, ageMinMonths: null,
    ageMaxMonths: null, category: null, locationName: 'כפר יונה 12', latitude: 32.1092, longitude: 34.8004,
    price: null, registrationRequired: null, registrationUrl: null, imageUrl: 'https://source.example/unapproved.jpg',
    iconUrl: null, cancellationStatus: null, sourcePublishedAt: null, sourceUpdatedAt: null,
    occurrenceFingerprint: `digitel-v1-${id.padStart(16, '0')}`, occurrenceIdentityKey: `identity-${id}`, ...overrides,
  };
}

test('manual allowlist creates exactly 30 verified future Events and strips every source image', () => {
  const candidates = [...SPRINT9_PASS_TRANSPORT_IDS].map((id) => candidate(id));
  const result = curateDigitelActivation(candidates, new Date('2026-08-05T12:00:00Z'));
  assert.equal(result.pass.length, 30);
  assert.equal(result.rows.filter((row) => row.decision === 'PASS').length, 30);
  assert.ok(result.pass.every((event) => event.imageUrl === null));
  assert.ok(result.pass.every((event) => event.verificationStatus === 'verified' && event.publicationStatus === 'published'));
  assert.ok(result.pass.every((event) => event.providerEventId === event.occurrenceFingerprint));
  assert.ok(result.pass.every((event) => event.endsAt === null && event.ageMinMonths === null && event.priceNote === null));
});

test('unreviewed, cancelled, adult-only, past, and malformed records cannot enter PASS', () => {
  const allowed = [...SPRINT9_PASS_TRANSPORT_IDS][0];
  const result = curateDigitelActivation([
    ...[...SPRINT9_PASS_TRANSPORT_IDS].map((id) => candidate(id)),
    candidate('unreviewed'),
    candidate(allowed, { occurrenceFingerprint: 'cancelled-unique', title: '*בוטל* הצגת ילדים' }),
    candidate(allowed, { occurrenceFingerprint: 'adult-unique', title: 'פעילות ילדים 18+' }),
    candidate(allowed, { occurrenceFingerprint: 'past-unique', startTime: '2026-01-01T00:00:00Z' }),
  ], new Date('2026-08-05T12:00:00Z'));
  assert.equal(result.pass.length, 30);
  assert.equal(result.rows.find((row) => row.providerTransportId === 'unreviewed')?.decision, 'REVIEW');
  assert.ok(result.rows.filter((row) => row.decision === 'FAIL').length >= 3);
});

test('known locations link only through explicit reviewed mappings', () => {
  const ids = [...SPRINT9_PASS_TRANSPORT_IDS];
  const candidates = ids.map((id, index) => candidate(id, { locationName: index === 0 ? 'שדרות שאול המלך 25' : 'Unknown venue' }));
  const result = curateDigitelActivation(candidates, new Date('2026-08-05T12:00:00Z'));
  assert.equal(result.pass.filter((event) => event.placeId).length, 1);
  assert.equal(result.pass.find((event) => event.providerTransportId === ids[0])?.placeId, '16e21a42-8edc-45fb-8c40-bdc109312a34');
});

test('generated importer is transactional, idempotent, guarded, and contains PASS records only', () => {
  const result = curateDigitelActivation([...SPRINT9_PASS_TRANSPORT_IDS].map((id) => candidate(id)), new Date('2026-08-05T12:00:00Z'));
  const sql = buildActivationImportSql(result.pass, 'digitel-sprint9-test-v1', '2026-08-05T12:00:00Z');
  assert.match(sql, /^-- Generated[\s\S]*begin;/);
  assert.match(sql, /on conflict \(provider, provider_event_id\) do update/);
  assert.match(sql, /Unexpected published Event count/);
  assert.match(sql, /commit;/);
  assert.doesNotMatch(sql, /source\.example|unapproved\.jpg|image_url[^\n]*https:/);
});

test('production migration is timestamped, rights-safe, RLS protected, and excludes Sprint 8 image tables', () => {
  const sql = readFileSync(new URL('../../supabase/migrations/20260805193000_activate_verified_events.sql', import.meta.url), 'utf8');
  assert.match(sql, /create table public\.event_providers/);
  assert.match(sql, /create table public\.events/);
  assert.match(sql, /create table public\.event_occurrences/);
  assert.match(sql, /location geography\(Point, 4326\)/);
  assert.match(sql, /Authenticated users read verified visible events/);
  assert.match(sql, /revoke all .* from anon, authenticated/);
  assert.match(sql, /image_url text check \(image_url is null\)/);
  assert.doesNotMatch(sql, /content_images|content_image_variants/);
  assert.match(sql, /ROLLBACK/);
});
