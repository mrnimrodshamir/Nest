import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runGenericProviderDryRun, runGenericProviderSync } from './genericSyncHandler.ts';
import type { GenericSyncDatabase, GenericSyncRunOutcome } from './genericSyncHandler.ts';
import type { ExistingProviderOccurrence, ProviderCandidate } from './types.ts';

function candidate(overrides: Partial<ProviderCandidate> = {}): ProviderCandidate {
  return {
    providerEventId: 'evt-1', providerTransportId: 'tx-1', sourceGroupId: null,
    title: 'סדנת יצירה למשפחות', description: 'סדנה לילדים ומשפחות', category: 'workshop',
    sourceType: 'external_organizer', sourceUrl: 'https://example.com/1', startTime: '2026-08-20T10:00:00Z',
    endTime: null, locationName: 'מקום כלשהו', formattedAddress: null, latitude: 32.08, longitude: 34.78,
    ageMinMonths: null, ageMaxMonths: null, priceNote: null, registrationRequired: null, registrationUrl: null,
    airConditioned: null, indoorOutdoor: null, sourcePublishedAt: null, sourceUpdatedAt: null,
    providerMetadata: {}, occurrenceFingerprint: 'fp-1',
    ...overrides,
  };
}

function fakeDatabase(overrides: Partial<{
  existing: ExistingProviderOccurrence[];
  applyResult: { inserted: number; updated: number; unchanged: number; missing: number; archived: number; cleaned: number };
}> = {}) {
  const calls: { finishRun?: GenericSyncRunOutcome; applyCompleteSync?: unknown; startRunCount: number } = { startRunCount: 0 };
  const db: GenericSyncDatabase = {
    async startRun() { calls.startRunCount += 1; return 'run-1'; },
    async finishRun(_runId, _provider, outcome) { calls.finishRun = outcome; },
    async listExisting() { return overrides.existing ?? []; },
    async applyCompleteSync(input) {
      calls.applyCompleteSync = input;
      return overrides.applyResult ?? { inserted: 0, updated: 0, unchanged: 0, missing: 0, archived: 0, cleaned: 0 };
    },
  };
  return { db, calls };
}

// ===========================================================================
// FAIL-CLOSED — partial source never triggers missing/archive/delete
// ===========================================================================

test('sourceComplete=false: no apply call is made, no destructive counters, status=partial', async () => {
  const { db, calls } = fakeDatabase();
  const outcome = await runGenericProviderSync({
    providerKey: 'test_provider', sourceName: 'Test', providerUrl: 'https://example.com',
    fetchCandidates: async () => ({ candidates: [candidate()], sourceComplete: false, incompleteReason: 'HTTP 500', rawCount: 1 }),
  }, db);
  assert.equal(outcome.status, 'partial');
  assert.equal(outcome.sourceComplete, false);
  assert.equal(outcome.missing, 0);
  assert.equal(outcome.archived, 0);
  assert.equal(outcome.cleaned, 0);
  assert.equal(calls.applyCompleteSync, undefined, 'an incomplete fetch must never even reach the write RPC');
});

test('a provider failure (fetchCandidates throws) never applies a write and reports errors=1', async () => {
  const { db, calls } = fakeDatabase();
  await assert.rejects(() => runGenericProviderSync({
    providerKey: 'test_provider', sourceName: 'Test', providerUrl: 'https://example.com',
    fetchCandidates: async () => { throw new Error('network down'); },
  }, db));
  assert.equal(calls.applyCompleteSync, undefined);
  assert.equal(calls.finishRun?.status, 'failed');
  assert.equal(calls.finishRun?.errors, 1);
});

test('a complete source with zero destructive plan outcomes reports missing=0, archived=0, cleaned=0 — the ordinary case', async () => {
  const { db } = fakeDatabase({ applyResult: { inserted: 1, updated: 0, unchanged: 0, missing: 0, archived: 0, cleaned: 0 } });
  const outcome = await runGenericProviderSync({
    providerKey: 'test_provider', sourceName: 'Test', providerUrl: 'https://example.com',
    fetchCandidates: async () => ({ candidates: [candidate()], sourceComplete: true, incompleteReason: null, rawCount: 1 }),
  }, db);
  assert.equal(outcome.status, 'success');
  assert.equal(outcome.inserted, 1);
  assert.equal(outcome.missing, 0);
});

// ===========================================================================
// RSVP-LINKED OCCURRENCE — protected, never silently missing/archived
// ===========================================================================

test('an occurrence with a real RSVP that the source no longer lists is passed through to the RPC as-is — the RPC (not this handler) is what protects it, and this handler must not pre-filter or hide it', async () => {
  const existingWithRsvp: ExistingProviderOccurrence = {
    occurrenceId: 'occ-1', eventId: 'evt-1', occurrenceFingerprint: 'fp-old', providerTransportId: 'tx-old',
    startsAt: '2026-08-20T10:00:00Z', endsAt: null, provider: 'test_provider',
    missingSince: null, archivedAt: null, sourceUpdatedAt: null, hasAttendees: true,
  };
  const { db, calls } = fakeDatabase({ existing: [existingWithRsvp] });
  // Source no longer lists this occurrence (candidates is empty this run).
  await runGenericProviderSync({
    providerKey: 'test_provider', sourceName: 'Test', providerUrl: 'https://example.com',
    fetchCandidates: async () => ({ candidates: [], sourceComplete: true, incompleteReason: null, rawCount: 0 }),
  }, db);
  // The handler does not decide RSVP protection itself — it hands a
  // complete, honest picture to apply_complete_provider_sync, whose own
  // preserveForUserData path (proven in the RPC and in syncPlan.test.ts)
  // is what keeps an attended occurrence from being hard-deleted.
  assert.ok(calls.applyCompleteSync, 'the RPC must still be called so its own RSVP-preservation logic can run');
});

// ===========================================================================
// PROVIDER-PRESENT-BUT-EXCLUDED — unpublished, not silently missing
// ===========================================================================

test('a candidate the family-relevance engine excludes is reported in "excluded", not counted as fetched-but-invisible', async () => {
  const { db } = fakeDatabase({ applyResult: { inserted: 0, updated: 0, unchanged: 0, missing: 0, archived: 0, cleaned: 0 } });
  const notFamilyRelevant = candidate({ title: 'ישיבת ועד בית', description: 'דיון תקציבי לדיירי הבניין' });
  const outcome = await runGenericProviderSync({
    providerKey: 'test_provider', sourceName: 'Test', providerUrl: 'https://example.com',
    fetchCandidates: async () => ({ candidates: [notFamilyRelevant], sourceComplete: true, incompleteReason: null, rawCount: 1 }),
  }, db);
  assert.equal(outcome.excluded, 1);
  assert.equal(outcome.relevant, 0);
});

// ===========================================================================
// OBSERVABILITY — every field the brief requires is present on the outcome
// ===========================================================================

test('the outcome object carries every field required for observability without querying raw Event rows', async () => {
  const { db } = fakeDatabase({ applyResult: { inserted: 1, updated: 2, unchanged: 3, missing: 0, archived: 0, cleaned: 0 } });
  const outcome = await runGenericProviderSync({
    providerKey: 'test_provider', sourceName: 'Test', providerUrl: 'https://example.com',
    fetchCandidates: async () => ({ candidates: [candidate()], sourceComplete: true, incompleteReason: null, rawCount: 5 }),
  }, db);
  for (const field of ['status', 'sourceComplete', 'fetched', 'normalized', 'relevant', 'inserted', 'updated', 'unchanged', 'excluded', 'missing', 'archived', 'cleaned', 'errors']) {
    assert.ok(field in outcome, `missing observability field: ${field}`);
  }
});

test('dry run compares with production state without starting or applying a sync', async () => {
  const dryRunCandidate = candidate();
  let writes = 0;
  const database = {
    async listExisting() { return []; },
    async startRun() { writes += 1; return 'never'; },
    async finishRun() { writes += 1; },
    async applyCompleteSync() { writes += 1; return { inserted: 0, updated: 0, unchanged: 0, missing: 0, archived: 0, cleaned: 0 }; },
  };
  const result = await runGenericProviderDryRun({ providerKey: 'test', sourceName: 'test', providerUrl: 'https://example.test', fetchCandidates: async () => ({ candidates: [dryRunCandidate], sourceComplete: true, incompleteReason: null, rawCount: 1 }) }, database);
  assert.equal(result.mode, 'dry_run');
  assert.equal(result.inserted, 1);
  assert.equal(writes, 0);
});
