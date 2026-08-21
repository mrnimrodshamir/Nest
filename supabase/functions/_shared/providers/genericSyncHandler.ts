/** Generic scheduled-sync handler for any provider built on the generic
 *  ProviderCandidate contract (Tel Aviv Port, Cinematheque, and any future
 *  provider that is NOT DigiTel, which keeps its own dedicated
 *  sync-digitel-events/handler.ts unchanged, per the same reasoning as
 *  fingerprint.ts and syncPlan.ts: DigiTel's live, already-tested path is
 *  never touched by a new provider's code).
 *
 *  ONE handler, parameterized per provider — not one handler per provider
 *  copy-pasted — so there is exactly one scheduler code path to reason
 *  about for every generic provider, matching "only ONE scheduler path per
 *  provider, no duplicate cron jobs" from the brief.
 *
 *  FAIL-CLOSED, same contract as DigiTel: sourceComplete=false from the
 *  connector propagates straight through to buildProviderSyncPlan, which
 *  already refuses to decide missing/archive/delete from an incomplete
 *  fetch — see syncPlan.ts. This handler adds nothing destructive of its
 *  own; it is a thin orchestration layer over already-tested primitives. */
import type { ExistingProviderOccurrence, ProviderCandidate } from './types.ts';
import { assessFamilyRelevance } from './relevance.ts';
import { buildProviderSyncPlan } from './syncPlan.ts';
import { createOccurrenceId } from '../digitel/eventMapping.ts';

export interface GenericFetchResult {
  candidates: ProviderCandidate[];
  sourceComplete: boolean;
  incompleteReason: string | null;
  rawCount: number;
}

export interface GenericSyncRunOutcome {
  status: 'success' | 'partial' | 'failed';
  sourceComplete: boolean;
  fetched: number;
  normalized: number;
  relevant: number;
  inserted: number;
  updated: number;
  unchanged: number;
  excluded: number;
  missing: number;
  archived: number;
  cleaned: number;
  errors: number;
  errorSummary: string | null;
}

export interface GenericSyncDatabase {
  startRun(provider: string): Promise<string>;
  finishRun(runId: string, provider: string, outcome: GenericSyncRunOutcome): Promise<void>;
  listExisting(provider: string): Promise<ExistingProviderOccurrence[]>;
  applyCompleteSync(input: { provider: string; runId: string; observedAt: string; sourceComplete: boolean; candidates: unknown[] }): Promise<{
    inserted: number; updated: number; unchanged: number; missing: number; archived: number; cleaned: number;
  }>;
}

export interface ProviderSyncConfig {
  providerKey: string;
  cityId?: string;
  sourceName: string;
  providerUrl: string;
  fetchCandidates: () => Promise<GenericFetchResult>;
}

export interface GenericDryRunOutcome extends GenericSyncRunOutcome {
  mode: 'dry_run';
  exactDuplicates: number;
  probableDuplicates: number;
  ambiguousDuplicates: number;
  distinct: number;
}

/** Read-only production comparison. It deliberately never starts a sync run
 * and therefore cannot reach the write RPC. */
export async function runGenericProviderDryRun(config: ProviderSyncConfig, database: Pick<GenericSyncDatabase, 'listExisting'>): Promise<GenericDryRunOutcome> {
  const fetched = await config.fetchCandidates();
  const existing = await database.listExisting(config.providerKey);
  const relevant = fetched.candidates.filter((candidate) => assessFamilyRelevance({
    title: candidate.title, description: candidate.description,
    sourceType: candidate.category, locationName: candidate.locationName,
  }).relevant);
  const plan = buildProviderSyncPlan({ provider: config.providerKey, candidates: relevant, existing, sourceComplete: fetched.sourceComplete, now: new Date() });
  const counts = new Map<string, number>();
  for (const candidate of relevant) counts.set(candidate.occurrenceFingerprint, (counts.get(candidate.occurrenceFingerprint) ?? 0) + 1);
  const exactDuplicates = [...counts.values()].reduce((sum, count) => sum + Math.max(0, count - 1), 0);
  return {
    mode: 'dry_run', status: fetched.sourceComplete ? 'success' : 'partial', sourceComplete: fetched.sourceComplete,
    fetched: fetched.rawCount, normalized: fetched.candidates.length, relevant: relevant.length,
    inserted: fetched.sourceComplete ? plan.inserts.length : 0, updated: fetched.sourceComplete ? plan.updates.length : 0,
    unchanged: fetched.sourceComplete ? plan.unchanged.length : 0, excluded: fetched.candidates.length - relevant.length,
    missing: fetched.sourceComplete ? plan.newlyMissing.length : 0, archived: fetched.sourceComplete ? plan.archive.length : 0,
    cleaned: fetched.sourceComplete ? plan.hardDelete.length : 0, errors: fetched.sourceComplete ? 0 : 1, errorSummary: fetched.incompleteReason,
    exactDuplicates, probableDuplicates: 0, ambiguousDuplicates: 0, distinct: counts.size,
  };
}

export async function runGenericProviderSync(config: ProviderSyncConfig, database: GenericSyncDatabase): Promise<GenericSyncRunOutcome> {
  const now = new Date();
  const observedAt = now.toISOString();
  const runId = await database.startRun(config.providerKey);
  const base: GenericSyncRunOutcome = {
    status: 'failed', sourceComplete: false, fetched: 0, normalized: 0, relevant: 0,
    inserted: 0, updated: 0, unchanged: 0, excluded: 0, missing: 0, archived: 0, cleaned: 0,
    errors: 0, errorSummary: null,
  };

  try {
    const fetchResult = await config.fetchCandidates();
    const existing = await database.listExisting(config.providerKey);

    const relevanceResults = fetchResult.candidates.map((candidate) => ({
      candidate,
      relevance: assessFamilyRelevance({
        title: candidate.title, description: candidate.description,
        sourceType: candidate.category, locationName: candidate.locationName,
      }),
    }));
    const relevant = relevanceResults.filter((row) => row.relevance.relevant).map((row) => row.candidate);
    const excludedCount = relevanceResults.length - relevant.length;

    const plan = buildProviderSyncPlan({
      provider: config.providerKey, candidates: relevant, existing,
      sourceComplete: fetchResult.sourceComplete, now,
    });

    if (!fetchResult.sourceComplete) {
      const partial: GenericSyncRunOutcome = {
        ...base, status: 'partial', sourceComplete: false,
        fetched: fetchResult.rawCount, normalized: fetchResult.candidates.length, relevant: relevant.length,
        excluded: excludedCount, errorSummary: fetchResult.incompleteReason,
      };
      await database.finishRun(runId, config.providerKey, partial);
      return partial;
    }

    const eligible = new Set([...plan.inserts, ...plan.updates, ...plan.unchanged].map((c) => c.occurrenceFingerprint));
    const candidateRows = relevant.map((candidate) => toSyncRow(candidate, config, eligible.has(candidate.occurrenceFingerprint)));

    const applied = await database.applyCompleteSync({
      provider: config.providerKey, runId, observedAt, sourceComplete: true, candidates: candidateRows,
    });

    const success: GenericSyncRunOutcome = {
      ...base, status: 'success', sourceComplete: true,
      fetched: fetchResult.rawCount, normalized: fetchResult.candidates.length, relevant: relevant.length,
      excluded: excludedCount, inserted: applied.inserted, updated: applied.updated, unchanged: applied.unchanged,
      missing: applied.missing, archived: applied.archived, cleaned: applied.cleaned,
    };
    await database.finishRun(runId, config.providerKey, success);
    return success;
  } catch (error) {
    const failed: GenericSyncRunOutcome = { ...base, status: 'failed', errors: 1, errorSummary: safeError(error) };
    await database.finishRun(runId, config.providerKey, failed);
    throw error;
  }
}

function toSyncRow(candidate: ProviderCandidate, config: ProviderSyncConfig, eligibleForNestupPublication: boolean) {
  return {
    cityId: config.cityId ?? 'tel_aviv',
    eligibleForNestupPublication,
    providerEventId: candidate.providerEventId,
    providerTransportId: candidate.providerTransportId,
    occurrenceId: createOccurrenceId(config.providerKey, candidate.providerEventId, candidate.startTime),
    occurrenceFingerprint: candidate.occurrenceFingerprint,
    title: candidate.title,
    description: candidate.description,
    category: candidate.category,
    sourceType: candidate.sourceType,
    sourceUrl: candidate.sourceUrl,
    sourceName: config.sourceName,
    providerUrl: config.providerUrl,
    startsAt: candidate.startTime,
    endsAt: candidate.endTime,
    locationName: candidate.locationName,
    formattedAddress: candidate.formattedAddress,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    ageMinMonths: candidate.ageMinMonths,
    ageMaxMonths: candidate.ageMaxMonths,
    priceNote: candidate.priceNote,
    registrationRequired: candidate.registrationRequired,
    registrationUrl: candidate.registrationUrl,
    sourcePublishedAt: candidate.sourcePublishedAt,
    sourceUpdatedAt: candidate.sourceUpdatedAt,
    providerMetadata: candidate.providerMetadata,
  };
}

function safeError(error: unknown): string {
  if (error instanceof Error) return error.message.slice(0, 500);
  return 'Unexpected sync failure';
}
