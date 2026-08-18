import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildProviderSyncPlan, emptyProviderPlan, MISSING_GRACE_DAYS, RETENTION_DAYS } from './syncPlan.ts';
import type { ExistingProviderOccurrence, ProviderCandidate } from './types.ts';

const NOW = new Date('2026-08-18T12:00:00Z');

function candidate(overrides: Partial<ProviderCandidate> = {}): ProviderCandidate {
  return {
    providerEventId: 'evt-1', providerTransportId: 'slug-1', sourceGroupId: null,
    title: 'שעת סיפור לפעוטות', description: null, category: 'story_time', sourceType: 'municipal',
    sourceUrl: 'https://example.org/e/1', startTime: '2026-08-20T10:00:00+03:00', endTime: null,
    locationName: 'ספרייה', formattedAddress: null, latitude: 32.08, longitude: 34.78,
    ageMinMonths: 0, ageMaxMonths: 36, priceNote: null, registrationRequired: null,
    registrationUrl: null, airConditioned: null, indoorOutdoor: 'indoor',
    sourcePublishedAt: null, sourceUpdatedAt: '2026-08-17T00:00:00Z',
    providerMetadata: {}, occurrenceFingerprint: 'fp-1',
    ...overrides,
  };
}

function existing(overrides: Partial<ExistingProviderOccurrence> = {}): ExistingProviderOccurrence {
  return {
    occurrenceId: 'occ-1', eventId: 'evt-db-1', occurrenceFingerprint: 'fp-1',
    providerTransportId: 'slug-1', startsAt: '2026-08-20T10:00:00+03:00', endsAt: null,
    provider: 'beit_ariela_libraries', missingSince: null, archivedAt: null,
    sourceUpdatedAt: '2026-08-16T00:00:00Z', hasAttendees: false,
    ...overrides,
  };
}

// ===========================================================================
// COMPLETE SOURCE
// ===========================================================================

test('a new candidate from a complete fetch is an insert', () => {
  const plan = buildProviderSyncPlan({
    provider: 'beit_ariela_libraries', candidates: [candidate()], existing: [], sourceComplete: true, now: NOW,
  });
  assert.equal(plan.inserts.length, 1);
  assert.equal(plan.updates.length, 0);
});

test('a candidate matching an existing fingerprint with no newer sourceUpdatedAt is unchanged', () => {
  const plan = buildProviderSyncPlan({
    provider: 'beit_ariela_libraries',
    candidates: [candidate({ sourceUpdatedAt: '2026-08-16T00:00:00Z' })],
    existing: [existing()], sourceComplete: true, now: NOW,
  });
  assert.equal(plan.unchanged.length, 1);
  assert.deepEqual(plan.seen, ['occ-1']);
});

test('a candidate whose provider stamped a newer sourceUpdatedAt is an update', () => {
  const plan = buildProviderSyncPlan({
    provider: 'beit_ariela_libraries',
    candidates: [candidate({ sourceUpdatedAt: '2026-08-18T00:00:00Z' })],
    existing: [existing({ sourceUpdatedAt: '2026-08-16T00:00:00Z' })],
    sourceComplete: true, now: NOW,
  });
  assert.equal(plan.updates.length, 1);
});

// ===========================================================================
// PARTIAL / INCOMPLETE SOURCE — the central safety rule
// ===========================================================================

test('an incomplete fetch never produces missing/archive/delete, even for occurrences absent this run', () => {
  const plan = buildProviderSyncPlan({
    provider: 'beit_ariela_libraries', candidates: [],
    existing: [existing({ startsAt: '2026-09-01T10:00:00+03:00' })], // future, absent, would normally go missing
    sourceComplete: false, now: NOW,
  });
  assert.deepEqual(plan.newlyMissing, []);
  assert.deepEqual(plan.archive, []);
  assert.deepEqual(plan.hardDelete, []);
});

test('inserts and updates still happen on an incomplete fetch — adding/refreshing what WAS returned cannot destroy anything', () => {
  const plan = buildProviderSyncPlan({
    provider: 'beit_ariela_libraries', candidates: [candidate()], existing: [], sourceComplete: false, now: NOW,
  });
  assert.equal(plan.inserts.length, 1);
});

// ===========================================================================
// FINISHED EVENT — expiry is not withdrawal
// ===========================================================================

test('a finished occurrence absent from the response is NOT marked missing — it simply ended', () => {
  const plan = buildProviderSyncPlan({
    provider: 'beit_ariela_libraries', candidates: [],
    existing: [existing({ startsAt: '2026-08-10T10:00:00+03:00', endsAt: '2026-08-10T11:00:00+03:00' })],
    sourceComplete: true, now: NOW,
  });
  assert.deepEqual(plan.newlyMissing, []);
});

test('a finished occurrence past retention with no RSVPs is eligible for hard delete', () => {
  const plan = buildProviderSyncPlan({
    provider: 'beit_ariela_libraries', candidates: [],
    existing: [existing({
      startsAt: '2026-06-01T10:00:00+03:00', endsAt: '2026-06-01T11:00:00+03:00', hasAttendees: false,
    })],
    sourceComplete: true, now: NOW,
  });
  assert.deepEqual(plan.hardDelete, ['occ-1']);
  assert.deepEqual(plan.preserveForUserData, []);
});

// ===========================================================================
// RSVP PRESERVATION — never allow a sync to destroy attendance
// ===========================================================================

test('a finished occurrence past retention WITH an RSVP is preserved, never hard-deleted', () => {
  const plan = buildProviderSyncPlan({
    provider: 'beit_ariela_libraries', candidates: [],
    existing: [existing({
      startsAt: '2026-06-01T10:00:00+03:00', endsAt: '2026-06-01T11:00:00+03:00', hasAttendees: true,
    })],
    sourceComplete: true, now: NOW,
  });
  assert.deepEqual(plan.preserveForUserData, ['occ-1']);
  assert.deepEqual(plan.hardDelete, []);
});

test('an RSVP never blocks an occurrence from being refreshed while it is still present', () => {
  const plan = buildProviderSyncPlan({
    provider: 'beit_ariela_libraries',
    candidates: [candidate({ sourceUpdatedAt: '2026-08-18T00:00:00Z' })],
    existing: [existing({ hasAttendees: true, sourceUpdatedAt: '2026-08-16T00:00:00Z' })],
    sourceComplete: true, now: NOW,
  });
  assert.equal(plan.updates.length, 1, 'still updated normally — RSVP does not freeze the row');
});

// ===========================================================================
// PROVIDER DISAPPEARANCE — grace period before archive
// ===========================================================================

test('a future occurrence absent from a complete response is newly missing, not archived immediately', () => {
  const plan = buildProviderSyncPlan({
    provider: 'beit_ariela_libraries', candidates: [],
    existing: [existing({ startsAt: '2026-09-01T10:00:00+03:00', missingSince: null })],
    sourceComplete: true, now: NOW,
  });
  assert.deepEqual(plan.newlyMissing, ['occ-1']);
  assert.deepEqual(plan.archive, []);
});

test(`still-missing after the ${MISSING_GRACE_DAYS}-day grace period is archived`, () => {
  const longMissingSince = new Date(NOW.getTime() - (MISSING_GRACE_DAYS + 1) * 86_400_000).toISOString();
  const plan = buildProviderSyncPlan({
    provider: 'beit_ariela_libraries', candidates: [],
    existing: [existing({ startsAt: '2026-09-01T10:00:00+03:00', missingSince: longMissingSince })],
    sourceComplete: true, now: NOW,
  });
  assert.deepEqual(plan.archive, ['occ-1']);
});

test('reappearing after being marked missing clears the missing state (via "seen")', () => {
  const plan = buildProviderSyncPlan({
    provider: 'beit_ariela_libraries',
    candidates: [candidate()],
    existing: [existing({ missingSince: '2026-08-17T00:00:00Z' })],
    sourceComplete: true, now: NOW,
  });
  assert.ok(plan.seen.includes('occ-1'));
  assert.ok(!plan.newlyMissing.includes('occ-1'));
  assert.ok(!plan.archive.includes('occ-1'));
});

// ===========================================================================
// PROVIDER-LOCAL DUPLICATE — matched by fingerprint OR transport id fallback
// ===========================================================================

test('a repeat candidate with the SAME fingerprint matches the existing row, not a fresh insert', () => {
  const plan = buildProviderSyncPlan({
    provider: 'beit_ariela_libraries',
    candidates: [candidate({ occurrenceFingerprint: 'fp-1', providerEventId: 'fp-1' })],
    existing: [existing({ occurrenceFingerprint: 'fp-1' })],
    sourceComplete: true, now: NOW,
  });
  assert.equal(plan.inserts.length, 0);
});

test('a changed fingerprint still matches via the stable providerTransportId fallback', () => {
  const plan = buildProviderSyncPlan({
    provider: 'beit_ariela_libraries',
    candidates: [candidate({ occurrenceFingerprint: 'fp-NEW', providerEventId: 'fp-NEW', providerTransportId: 'slug-1' })],
    existing: [existing({ occurrenceFingerprint: 'fp-OLD', providerTransportId: 'slug-1' })],
    sourceComplete: true, now: NOW,
  });
  assert.equal(plan.inserts.length, 0, 'must not re-insert — the transport id proves it is the same record');
  assert.ok(plan.seen.includes('occ-1'));
});

// ===========================================================================
// EXCLUDED-BUT-PRESENT — relevance can change without the provider withdrawing
// ===========================================================================

test('a candidate the relevance filter rejects, but that already exists, is excludedButPresent — not missing', () => {
  const plan = buildProviderSyncPlan({
    provider: 'beit_ariela_libraries',
    candidates: [candidate({ title: 'ישיבת ועדה', description: null })],
    existing: [existing()],
    sourceComplete: true, now: NOW,
  });
  assert.equal(plan.excluded.length, 1);
  assert.deepEqual(plan.excludedButPresent, ['occ-1']);
  assert.deepEqual(plan.newlyMissing, []);
});

test('emptyProviderPlan starts every bucket empty', () => {
  const plan = emptyProviderPlan();
  for (const key of Object.keys(plan) as (keyof typeof plan)[]) assert.deepEqual(plan[key], []);
});

void RETENTION_DAYS; // imported for the retention-window tests' documentation value
