/** The decision layer of the DigiTel sync: given what the provider returned and
 *  what the database already holds, decide what SHOULD happen.
 *
 *  Deliberately pure. Every dangerous rule in this pipeline — what counts as
 *  missing, what may be archived, what may be hard-deleted — is decided here,
 *  with no network and no database, so it can be tested exhaustively. The Edge
 *  Function's only job is to fetch, call this, and apply the result.
 *
 *  THE CENTRAL SAFETY RULE: nothing destructive may be decided from an
 *  incomplete fetch. A timeout, a malformed page or a partial pagination run
 *  must never be read as "the provider deleted these events". Every function
 *  that can remove or hide data takes `sourceComplete` and returns empty when it
 *  is false. That is enforced by tests, not by convention.
 */
import type { DigitelEventCandidate } from './connector.ts';
import { assessFamilyRelevance } from './relevance.ts';

/** Days a finished occurrence is retained before it becomes eligible for
 *  cleanup. It has already left Discovery via active_event_occurrences on the
 *  day it ended; this window exists purely for debugging and reconciliation. */
export const RETENTION_DAYS = 30;

/** Consecutive complete syncs an occurrence may be absent for before it is
 *  archived. One missing sync is a provider hiccup; a record still gone after a
 *  full grace period is genuinely withdrawn. */
export const MISSING_GRACE_DAYS = 3;

export interface ExistingOccurrence {
  occurrenceId: string;
  eventId: string;
  occurrenceFingerprint: string;
  startsAt: string;
  endsAt: string | null;
  provider: string;
  missingSince: string | null;
  archivedAt: string | null;
  sourceUpdatedAt: string | null;
  /** DigiTel NbrId grouping metadata. Combined with startsAt it is the stable
   * fallback when mutable normalized fields change the fingerprint. */
  sourceGroupId?: string | null;
  /** Whether any user has RSVP'd. Decided by the caller with a join, because
   *  "does user data exist" is a database question, not a rules question. */
  hasAttendees: boolean;
}

export interface SyncPlan {
  inserts: DigitelEventCandidate[];
  updates: DigitelEventCandidate[];
  unchanged: DigitelEventCandidate[];
  excluded: { candidate: DigitelEventCandidate; reason: string }[];
  /** Provider returned the occurrence, but current NestUp relevance rules do
   * not permit publication. It is seen, not missing. */
  excludedButPresent: string[];
  /** Seen this run: refresh last_seen_at and clear any missing state. */
  seen: string[];
  /** Absent from a COMPLETE response and not yet marked: set missing_since. */
  newlyMissing: string[];
  /** Absent beyond the grace period: archive (never hard-delete from here). */
  archive: string[];
  /** Finished, past retention, no user data: safe to hard-delete. */
  hardDelete: string[];
  /** Finished, past retention, but carries RSVPs: archive instead. */
  preserveForUserData: string[];
}

export function emptyPlan(): SyncPlan {
  return {
    inserts: [], updates: [], unchanged: [], excluded: [],
    excludedButPresent: [],
    seen: [], newlyMissing: [], archive: [], hardDelete: [], preserveForUserData: [],
  };
}

/** Builds the full plan. `sourceComplete` gates every destructive decision. */
export function buildSyncPlan(input: {
  candidates: readonly DigitelEventCandidate[];
  existing: readonly ExistingOccurrence[];
  sourceComplete: boolean;
  now: Date;
  provider?: string;
}): SyncPlan {
  const provider = input.provider ?? 'tel_aviv_digitel';
  const plan = emptyPlan();
  const existingByFingerprint = new Map(input.existing.map((row) => [row.occurrenceFingerprint, row]));
  const existingByStableKey = uniqueStableOccurrences(input.existing);
  const uniqueCandidateKeys = uniqueStableCandidateKeys(input.candidates);

  // --- Relevance and upsert classification -------------------------------
  // These are safe regardless of completeness: adding or refreshing a record we
  // were just handed cannot destroy anything.
  const seenOccurrenceIds = new Set<string>();
  for (const candidate of input.candidates) {
    const candidateStableKey = stableOccurrenceKey(candidate.sourceGroupId, candidate.startTime);
    const existing = existingByFingerprint.get(candidate.occurrenceFingerprint)
      ?? (uniqueCandidateKeys.has(candidateStableKey) ? existingByStableKey.get(candidateStableKey) : undefined);
    if (existing) {
      seenOccurrenceIds.add(existing.occurrenceId);
      plan.seen.push(existing.occurrenceId);
    }
    const relevance = assessFamilyRelevance({
      title: candidate.title,
      description: candidate.description,
      sourceType: candidate.sourceType,
      locationName: candidate.locationName,
    });
    if (!relevance.relevant) {
      plan.excluded.push({ candidate, reason: relevance.reason });
      if (existing) plan.excludedButPresent.push(existing.occurrenceId);
      continue;
    }

    if (!existing) {
      plan.inserts.push(candidate);
      continue;
    }

    // The fingerprint already encodes identity and timing, so a match means the
    // occurrence is the same one. Only mutable content can have changed.
    if (hasContentChanged(candidate, existing)) plan.updates.push(candidate);
    else plan.unchanged.push(candidate);
  }

  // --- Everything below is destructive, and therefore gated ---------------
  if (!input.sourceComplete) return plan;

  const nowMs = input.now.getTime();
  for (const row of input.existing) {
    if (row.provider !== provider) continue;      // never touch other providers
    if (row.archivedAt) continue;                 // already archived

    const stillPresent = seenOccurrenceIds.has(row.occurrenceId);
    const endedAt = Date.parse(row.endsAt ?? row.startsAt);
    const finished = Number.isFinite(endedAt) && endedAt < nowMs;
    const pastRetention = Number.isFinite(endedAt)
      && endedAt < nowMs - RETENTION_DAYS * 86_400_000;

    if (stillPresent) continue;

    // A finished occurrence naturally drops out of the provider's window. That
    // is expiry, not withdrawal, and must not be treated as "missing".
    if (finished) {
      if (!pastRetention) continue;               // inside the retention window
      if (row.hasAttendees) plan.preserveForUserData.push(row.occurrenceId);
      else plan.hardDelete.push(row.occurrenceId);
      continue;
    }

    // A FUTURE occurrence that vanished from a complete response is a genuine
    // provider withdrawal. Still not deleted — marked, then archived if it stays
    // gone. Users may already have RSVP'd to it.
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

/** Only unique NbrId + occurrence-time pairs may bridge a fingerprint change.
 * Ambiguous provider groups intentionally fail closed and remain reviewable. */
function uniqueStableOccurrences(rows: readonly ExistingOccurrence[]): Map<string, ExistingOccurrence> {
  const groups = new Map<string, ExistingOccurrence[]>();
  for (const row of rows) {
    const key = stableOccurrenceKey(row.sourceGroupId, row.startsAt);
    if (!key) continue;
    const group = groups.get(key) ?? [];
    group.push(row);
    groups.set(key, group);
  }
  return new Map([...groups].flatMap(([key, group]) => group.length === 1 ? [[key, group[0]] as const] : []));
}

function uniqueStableCandidateKeys(candidates: readonly DigitelEventCandidate[]): Set<string> {
  const counts = new Map<string, number>();
  for (const candidate of candidates) {
    const key = stableOccurrenceKey(candidate.sourceGroupId, candidate.startTime);
    if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return new Set([...counts].flatMap(([key, count]) => count === 1 ? [key] : []));
}

function stableOccurrenceKey(sourceGroupId: string | null | undefined, startsAt: string): string {
  if (!sourceGroupId?.trim()) return '';
  const timestamp = Date.parse(startsAt);
  return Number.isFinite(timestamp) ? `${sourceGroupId.trim()}|${new Date(timestamp).toISOString()}` : '';
}

/** Content-level change detection. Timing is part of the fingerprint, so a
 *  changed time produces a different occurrence rather than an update. */
function hasContentChanged(candidate: DigitelEventCandidate, existing: ExistingOccurrence): boolean {
  // A provider that stamps its own updated_at is authoritative about change.
  // Without one, treat the record as unchanged rather than rewriting a row on
  // every sync — pointless writes make the log useless for spotting real churn.
  if (!candidate.sourceUpdatedAt) return false;
  if (!existing.sourceUpdatedAt) return true;
  const candidateUpdated = Date.parse(candidate.sourceUpdatedAt);
  const existingUpdated = Date.parse(existing.sourceUpdatedAt);
  return Number.isFinite(candidateUpdated) && Number.isFinite(existingUpdated)
    ? candidateUpdated > existingUpdated
    : candidate.sourceUpdatedAt !== existing.sourceUpdatedAt;
}
