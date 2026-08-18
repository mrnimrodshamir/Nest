/** The generic provider sync decision layer — deliberately pure, no network,
 *  no database, so it is testable exhaustively and reused unchanged by every
 *  provider except DigiTel (which keeps its own, unmodified, live-tested
 *  copy in digitel/syncPlan.ts).
 *
 *  THE CENTRAL SAFETY RULE, unchanged from DigiTel's version: nothing
 *  destructive may be decided from an incomplete fetch. Every function that
 *  can remove or hide data takes `sourceComplete` and returns early when it
 *  is false — enforced by the tests, not by convention.
 *
 *  Deliberately simpler than digitel/syncPlan.ts in one way: DigiTel's
 *  sourceGroupId + occurrence-time stable-key fallback exists because ArcGIS
 *  content can mutate in ways that change the content fingerprint while the
 *  underlying record has not. A provider whose connector supplies a stable
 *  native identifier (a URL slug, for instance) has no equivalent problem —
 *  `providerTransportId` already IS that stable key — so this only matches on
 *  fingerprint first, transport id second. A future provider that genuinely
 *  needs the group-based fallback can add it without touching this file or
 *  DigiTel's. */
import type { ExistingProviderOccurrence, ProviderCandidate } from './types.ts';
import { assessFamilyRelevance, type RelevanceHints } from './relevance.ts';

export const RETENTION_DAYS = 30;
export const MISSING_GRACE_DAYS = 3;

export interface ProviderSyncPlan {
  inserts: ProviderCandidate[];
  updates: ProviderCandidate[];
  unchanged: ProviderCandidate[];
  excluded: { candidate: ProviderCandidate; reason: string }[];
  excludedButPresent: string[];
  seen: string[];
  newlyMissing: string[];
  archive: string[];
  hardDelete: string[];
  preserveForUserData: string[];
}

export function emptyProviderPlan(): ProviderSyncPlan {
  return {
    inserts: [], updates: [], unchanged: [], excluded: [],
    excludedButPresent: [], seen: [], newlyMissing: [], archive: [],
    hardDelete: [], preserveForUserData: [],
  };
}

export function buildProviderSyncPlan(input: {
  provider: string;
  candidates: readonly ProviderCandidate[];
  existing: readonly ExistingProviderOccurrence[];
  sourceComplete: boolean;
  now: Date;
  relevanceHints?: RelevanceHints;
}): ProviderSyncPlan {
  const plan = emptyProviderPlan();
  const existingByFingerprint = new Map(input.existing.map((row) => [row.occurrenceFingerprint, row]));
  const existingByTransportId = new Map(
    input.existing
      .filter((row): row is ExistingProviderOccurrence & { providerTransportId: string } => !!row.providerTransportId)
      .map((row) => [row.providerTransportId, row] as const),
  );

  const seenOccurrenceIds = new Set<string>();
  for (const candidate of input.candidates) {
    const existing = existingByFingerprint.get(candidate.occurrenceFingerprint)
      ?? existingByTransportId.get(candidate.providerTransportId);
    if (existing) {
      seenOccurrenceIds.add(existing.occurrenceId);
      plan.seen.push(existing.occurrenceId);
    }

    const relevance = assessFamilyRelevance(
      {
        title: candidate.title,
        description: candidate.description,
        sourceType: candidate.category,
        locationName: candidate.locationName,
      },
      input.relevanceHints,
    );
    if (!relevance.relevant) {
      plan.excluded.push({ candidate, reason: relevance.reason });
      if (existing) plan.excludedButPresent.push(existing.occurrenceId);
      continue;
    }

    if (!existing) {
      plan.inserts.push(candidate);
      continue;
    }
    if (hasContentChanged(candidate, existing)) plan.updates.push(candidate);
    else plan.unchanged.push(candidate);
  }

  if (!input.sourceComplete) return plan;

  const nowMs = input.now.getTime();
  for (const row of input.existing) {
    if (row.provider !== input.provider) continue;
    if (row.archivedAt) continue;

    const stillPresent = seenOccurrenceIds.has(row.occurrenceId);
    const endedAt = Date.parse(row.endsAt ?? row.startsAt);
    const finished = Number.isFinite(endedAt) && endedAt < nowMs;
    const pastRetention = Number.isFinite(endedAt) && endedAt < nowMs - RETENTION_DAYS * 86_400_000;

    if (stillPresent) continue;

    if (finished) {
      if (!pastRetention) continue;
      if (row.hasAttendees) plan.preserveForUserData.push(row.occurrenceId);
      else plan.hardDelete.push(row.occurrenceId);
      continue;
    }

    if (!row.missingSince) {
      plan.newlyMissing.push(row.occurrenceId);
      continue;
    }
    const missingSinceMs = Date.parse(row.missingSince);
    if (Number.isFinite(missingSinceMs) && missingSinceMs < nowMs - MISSING_GRACE_DAYS * 86_400_000) {
      plan.archive.push(row.occurrenceId);
    }
  }

  return plan;
}

function hasContentChanged(candidate: ProviderCandidate, existing: ExistingProviderOccurrence): boolean {
  if (!candidate.sourceUpdatedAt) return false;
  if (!existing.sourceUpdatedAt) return true;
  const candidateUpdated = Date.parse(candidate.sourceUpdatedAt);
  const existingUpdated = Date.parse(existing.sourceUpdatedAt);
  return Number.isFinite(candidateUpdated) && Number.isFinite(existingUpdated)
    ? candidateUpdated > existingUpdated
    : candidate.sourceUpdatedAt !== existing.sourceUpdatedAt;
}
