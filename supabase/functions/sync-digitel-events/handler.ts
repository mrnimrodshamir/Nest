import type { DigitelEventCandidate } from '../_shared/digitel/connector.ts';
import {
  DigitelConnectorError,
  fetchAllDigitelFeatures,
  fetchAndValidateDigitelSource,
  normalizeDigitelFeatures,
} from '../_shared/digitel/connector.ts';
import { mapDigitelSyncCandidate, type DigitelSyncCandidate } from '../_shared/digitel/eventMapping.ts';
import { deduplicateDigitelCandidates } from '../_shared/digitel/staging.ts';
import { buildSyncPlan, type ExistingOccurrence, type SyncPlan } from '../_shared/digitel/syncPlan.ts';

const PROVIDER = 'tel_aviv_digitel';

export interface SyncDatabase {
  startRun(): Promise<string>;
  finishRun(runId: string, outcome: SyncRunOutcome): Promise<void>;
  listExisting(): Promise<ExistingOccurrence[]>;
  applyCompleteSync(input: { runId: string; observedAt: string; candidates: DigitelSyncCandidate[] }): Promise<ApplyCounts>;
}

export interface SyncRunOutcome {
  status: 'success' | 'partial' | 'failed';
  sourceComplete: boolean;
  fetched: number;
  normalized: number;
  duplicates: number;
  excluded: number;
  inserted: number;
  updated: number;
  unchanged: number;
  archived: number;
  cleaned: number;
  missing: number;
  error: string | null;
}

export interface ApplyCounts {
  inserted: number;
  updated: number;
  unchanged: number;
  missing: number;
  archived: number;
  cleaned: number;
  preserved: number;
}

export interface SyncResponse extends SyncRunOutcome {
  dryRun: boolean;
  runId: string;
  pagesFetched: number;
  relevant: number;
  preserved: number;
}

interface ConnectorDependencies {
  fetchMetadata?: typeof fetchAndValidateDigitelSource;
  fetchFeatures?: typeof fetchAllDigitelFeatures;
  now?: () => Date;
}

export async function runDigitelSync(
  input: { dryRun: boolean },
  database: SyncDatabase,
  dependencies: ConnectorDependencies = {},
): Promise<SyncResponse> {
  const fetchMetadata = dependencies.fetchMetadata ?? fetchAndValidateDigitelSource;
  const fetchFeatures = dependencies.fetchFeatures ?? fetchAllDigitelFeatures;
  const now = dependencies.now?.() ?? new Date();
  const observedAt = now.toISOString();
  const runId = await database.startRun();
  const base: SyncRunOutcome = {
    status: 'failed', sourceComplete: false, fetched: 0, normalized: 0, duplicates: 0, excluded: 0,
    inserted: 0, updated: 0, unchanged: 0, archived: 0, cleaned: 0, missing: 0, error: null,
  };

  try {
    const metadata = await fetchMetadata();
    if (!metadata.validation.valid) {
      const failed = { ...base, status: 'partial' as const, error: `Source schema validation failed: ${metadata.validation.errors.join(', ')}` };
      await database.finishRun(runId, failed);
      return { ...failed, dryRun: input.dryRun, runId, pagesFetched: 0, relevant: 0, preserved: 0 };
    }

    const fetched = await fetchFeatures();
    const normalized = normalizeDigitelFeatures(fetched.features, { now });
    const deduplicated = deduplicateDigitelCandidates(normalized.candidates);
    const existing = await database.listExisting();
    const plan = buildSyncPlan({ candidates: deduplicated.uniqueCandidates, existing, sourceComplete: true, now, provider: PROVIDER });
    // A complete executor applies every currently relevant canonical candidate.
    // Transport identity bridges the manually activated historical batch if the
    // provider has corrected identity-bearing fields since that one-off import.
    const relevant = [...plan.inserts, ...plan.updates, ...plan.unchanged];
    const planned = plannedCounts(plan);

    if (input.dryRun) {
      const success: SyncRunOutcome = {
        ...base, status: 'success', sourceComplete: true,
        fetched: fetched.features.length, normalized: normalized.candidates.length,
        duplicates: deduplicated.duplicateRecordCount, excluded: normalized.excluded.length + plan.excluded.length,
        ...planned,
      };
      await database.finishRun(runId, success);
      return { ...success, dryRun: true, runId, pagesFetched: fetched.pages, relevant: relevant.length, preserved: plan.preserveForUserData.length };
    }

    // The database RPC is the transaction boundary. It receives only records
    // returned by a fully validated, fully paginated source response.
    const applied = await database.applyCompleteSync({ runId, observedAt, candidates: relevant.map(mapDigitelSyncCandidate) });
    const success: SyncRunOutcome = {
      ...base, status: 'success', sourceComplete: true,
      fetched: fetched.features.length, normalized: normalized.candidates.length,
      duplicates: deduplicated.duplicateRecordCount, excluded: normalized.excluded.length + plan.excluded.length,
      inserted: applied.inserted, updated: applied.updated, unchanged: applied.unchanged,
      archived: applied.archived, cleaned: applied.cleaned, missing: applied.missing,
    };
    await database.finishRun(runId, success);
    return { ...success, dryRun: false, runId, pagesFetched: fetched.pages, relevant: relevant.length, preserved: applied.preserved };
  } catch (error) {
    const failed: SyncRunOutcome = { ...base, status: 'failed', error: safeError(error) };
    await database.finishRun(runId, failed);
    throw new SyncExecutionError(runId, failed.error);
  }
}

export class SyncExecutionError extends Error {
  readonly runId: string;

  constructor(runId: string, message: string) {
    super(message);
    this.name = 'SyncExecutionError';
    this.runId = runId;
  }
}

function plannedCounts(plan: SyncPlan): Pick<SyncRunOutcome, 'inserted' | 'updated' | 'unchanged' | 'archived' | 'cleaned' | 'missing'> {
  return {
    inserted: plan.inserts.length,
    updated: plan.updates.length,
    unchanged: plan.unchanged.length,
    archived: plan.archive.length + plan.preserveForUserData.length,
    cleaned: plan.hardDelete.length,
    missing: plan.newlyMissing.length,
  };
}

function safeError(error: unknown): string {
  if (error instanceof DigitelConnectorError) return `${error.code}: ${error.message}`;
  if (error instanceof Error) return error.message.slice(0, 500);
  return 'Unexpected sync failure';
}
