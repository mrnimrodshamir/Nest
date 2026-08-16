import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runDigitelSync, SyncExecutionError, type ApplyCounts, type SyncDatabase, type SyncRunOutcome } from '../../supabase/functions/sync-digitel-events/handler.ts';
import type { ArcGisFeature, FetchDigitelMetadataResult, FetchDigitelResult } from '../../supabase/functions/_shared/digitel/connector.ts';
import type { ExistingOccurrence } from '../../supabase/functions/_shared/digitel/syncPlan.ts';

const NOW = new Date('2026-08-14T12:00:00Z');

function feature(over: Record<string, unknown> = {}): ArcGisFeature {
  return {
    attributes: {
      OBJECTID: 1001, title: 'שעת סיפור לילדים', startdate: NOW.getTime() + 86_400_000,
      location: 'ספריית בית אריאלה', type: 'אירועים', NbrId: 77,
      description: 'סיפור ויצירה למשפחות', sitemapurl: 'https://www.tel-aviv.gov.il/event/1001',
      modified: NOW.getTime(), publishdate: NOW.getTime(), ...over,
    },
    geometry: { x: 34.78, y: 32.07 },
  };
}

function validMetadata(): FetchDigitelMetadataResult {
  return {
    metadata: {}, requestAttempts: 1, retryCount: 0,
    validation: { valid: true, layerId: 410, layerName: 'אירועים דיגיטל', geometryType: 'esriGeometryPoint', maxRecordCount: 500, supportsQuery: true, missingFields: [], errors: [], warnings: [] },
  };
}

class FakeDatabase implements SyncDatabase {
  outcomes: SyncRunOutcome[] = [];
  applyCalls = 0;
  existing: ExistingOccurrence[] = [];
  applied: ApplyCounts = { inserted: 1, updated: 0, unchanged: 0, missing: 0, archived: 0, cleaned: 0, preserved: 0, excludedPresent: 0, unpublished: 0 };
  async startRun() { return '11111111-1111-4111-8111-111111111111'; }
  async finishRun(_runId: string, outcome: SyncRunOutcome) { this.outcomes.push(outcome); }
  async listExisting() { return this.existing; }
  async applyCompleteSync() { this.applyCalls += 1; return this.applied; }
}

const fetched = (features: ArcGisFeature[]): FetchDigitelResult => ({ features, pages: 1, requestUrls: ['fixture'], requestAttempts: 1, retryCount: 0 });

test('dry-run plans a complete source without applying database changes', async () => {
  const database = new FakeDatabase();
  const result = await runDigitelSync({ dryRun: true }, database, {
    now: () => NOW, fetchMetadata: async () => validMetadata(), fetchFeatures: async () => fetched([feature()]),
  });
  assert.equal(result.sourceComplete, true);
  assert.equal(result.inserted, 1);
  assert.equal(result.relevant, 1);
  assert.equal(database.applyCalls, 0);
  assert.equal(database.outcomes[0].status, 'success');
});

test('production mode applies exactly one atomic complete-source call', async () => {
  const database = new FakeDatabase();
  const result = await runDigitelSync({ dryRun: false }, database, {
    now: () => NOW, fetchMetadata: async () => validMetadata(), fetchFeatures: async () => fetched([feature()]),
  });
  assert.equal(database.applyCalls, 1);
  assert.equal(result.inserted, 1);
  assert.equal(result.dryRun, false);
});

test('translation queue failure never changes a successful DigiTel sync', async () => {
  const database = new FakeDatabase();
  database.enqueueTranslations = async () => { throw new Error('translation provider unavailable'); };
  const result = await runDigitelSync({ dryRun: false }, database, {
    now: () => NOW, fetchMetadata: async () => validMetadata(), fetchFeatures: async () => fetched([feature()]),
  });
  assert.equal(result.status, 'success');
  assert.equal(result.sourceComplete, true);
  assert.equal(database.applyCalls, 1);
});

test('invalid source metadata fails closed before fetching or applying', async () => {
  const database = new FakeDatabase();
  let fetchedSource = false;
  const result = await runDigitelSync({ dryRun: false }, database, {
    now: () => NOW,
    fetchMetadata: async () => ({ ...validMetadata(), validation: { ...validMetadata().validation, valid: false, errors: ['required_fields_missing'] } }),
    fetchFeatures: async () => { fetchedSource = true; return fetched([]); },
  });
  assert.equal(result.sourceComplete, false);
  assert.equal(result.status, 'partial');
  assert.equal(fetchedSource, false);
  assert.equal(database.applyCalls, 0);
});

test('partial or failed pagination logs failure and never applies reconciliation', async () => {
  const database = new FakeDatabase();
  await assert.rejects(
    runDigitelSync({ dryRun: false }, database, {
      now: () => NOW, fetchMetadata: async () => validMetadata(), fetchFeatures: async () => { throw new Error('page two timeout'); },
    }),
    (error: unknown) => error instanceof SyncExecutionError,
  );
  assert.equal(database.applyCalls, 0);
  assert.equal(database.outcomes[0].sourceComplete, false);
  assert.equal(database.outcomes[0].status, 'failed');
});

test('duplicate source occurrences are reduced deterministically before persistence', async () => {
  const database = new FakeDatabase();
  const result = await runDigitelSync({ dryRun: true }, database, {
    now: () => NOW, fetchMetadata: async () => validMetadata(), fetchFeatures: async () => fetched([feature(), feature({ OBJECTID: 1002 })]),
  });
  assert.equal(result.duplicates, 1);
  assert.equal(result.relevant, 1);
});

test('production sends provider-present excluded rows to the atomic executor', async () => {
  const database = new FakeDatabase();
  let appliedCandidates: Array<{ eligibleForNestupPublication: boolean }> = [];
  database.existing = [
    {
      occurrenceId: 'occ-existing', eventId: 'event-existing', occurrenceFingerprint: 'digitel-v1-ignored',
      startsAt: new Date(NOW.getTime() + 86_400_000).toISOString(), endsAt: null,
      provider: 'tel_aviv_digitel', missingSince: null, archivedAt: null,
      sourceUpdatedAt: null, sourceGroupId: '77', hasAttendees: false,
    },
  ];
  database.applyCompleteSync = async (input) => {
    database.applyCalls += 1;
    appliedCandidates = input.candidates;
    return { ...database.applied, inserted: 0, excludedPresent: 1, unpublished: 1 };
  };
  const result = await runDigitelSync({ dryRun: false }, database, {
    now: () => NOW,
    fetchMetadata: async () => validMetadata(),
    fetchFeatures: async () => fetched([feature({ title: 'Adult concert workshop', description: null })]),
  });
  assert.equal(appliedCandidates.length, 1);
  assert.equal(appliedCandidates[0].eligibleForNestupPublication, false);
  assert.equal(result.excludedButPresent, 1);
  assert.equal(result.genuinelyMissing, 0);
});
