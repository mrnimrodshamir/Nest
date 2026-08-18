import type {
  DigitelEventCandidate,
  DigitelNormalizationResult,
  DigitelSourceValidation,
  ExcludedDigitelRecord,
// Relative, extensioned: this module is imported both by Deno (which requires
// the extension) and by the app's TypeScript, which tolerates it. The `@/` alias
// cannot be used here because Edge Functions bundle only what lives under
// supabase/functions/.
} from './connector.ts';

export interface DigitelDuplicateGroup {
  occurrenceFingerprint: string;
  canonicalProviderTransportId: string;
  duplicateProviderTransportIds: string[];
  sourceGroupIds: string[];
  titles: string[];
}

export interface DeduplicatedDigitelCandidates {
  uniqueCandidates: DigitelEventCandidate[];
  duplicateGroups: DigitelDuplicateGroup[];
  duplicateRecordCount: number;
}

export interface DigitelStagedRecord {
  status: 'ready' | 'duplicate_review';
  canonicalProviderTransportId: string;
  candidate: DigitelEventCandidate;
}

export interface DigitelStagingBundle {
  schemaVersion: 1;
  dryRun: true;
  publishedRecords: 0;
  generatedAt: string;
  source: {
    provider: 'tel_aviv_digitel';
    layerId: 410;
    sourceValidation: DigitelSourceValidation;
    pagesFetched: number;
    requestAttempts: number;
    retryCount: number;
  };
  stagedRecords: DigitelStagedRecord[];
  excludedRecords: ExcludedDigitelRecord[];
}

export interface DigitelStagingReport {
  generatedAt: string;
  dryRun: true;
  publishedRecords: 0;
  sourceValid: boolean;
  totalFetched: number;
  normalizedCandidates: number;
  uniqueCandidates: number;
  duplicateGroups: number;
  duplicateRecords: number;
  excludedRecords: number;
  readyForReview: number;
  pagesFetched: number;
  requestAttempts: number;
  retryCount: number;
}

export type DigitelQualityIssue =
  | 'missing_description'
  | 'missing_location'
  | 'missing_source_url'
  | 'missing_image_url'
  | 'missing_source_updated_at';

export interface DigitelCandidateQuality {
  providerTransportId: string;
  occurrenceFingerprint: string;
  score: number;
  band: 'high' | 'medium' | 'low';
  issues: DigitelQualityIssue[];
}

export interface DigitelQualityReport {
  generatedAt: string;
  candidateCount: number;
  averageScore: number;
  bands: Record<'high' | 'medium' | 'low', number>;
  issues: Record<DigitelQualityIssue, number>;
  candidates: DigitelCandidateQuality[];
}

export function deduplicateDigitelCandidates(candidates: readonly DigitelEventCandidate[]): DeduplicatedDigitelCandidates {
  const groups = new Map<string, DigitelEventCandidate[]>();
  for (const candidate of candidates) {
    const group = groups.get(candidate.occurrenceFingerprint) ?? [];
    group.push(candidate);
    groups.set(candidate.occurrenceFingerprint, group);
  }

  const uniqueCandidates: DigitelEventCandidate[] = [];
  const duplicateGroups: DigitelDuplicateGroup[] = [];
  let duplicateRecordCount = 0;
  for (const group of groups.values()) {
    const ordered = [...group].sort(compareCandidates);
    const [canonical, ...duplicates] = ordered;
    uniqueCandidates.push(canonical);
    if (duplicates.length > 0) {
      duplicateRecordCount += duplicates.length;
      duplicateGroups.push({
        occurrenceFingerprint: canonical.occurrenceFingerprint,
        canonicalProviderTransportId: canonical.providerTransportId,
        duplicateProviderTransportIds: duplicates.map((candidate) => candidate.providerTransportId),
        sourceGroupIds: [...new Set(ordered.flatMap((candidate) => candidate.sourceGroupId == null ? [] : [candidate.sourceGroupId]))],
        titles: [...new Set(ordered.map((candidate) => candidate.title))],
      });
    }
  }

  // SECOND PASS — collapse duplicate providerTransportIds, not just duplicate
  // fingerprints. The two are different questions: occurrenceFingerprint is
  // content-derived (title+time+location+coords), providerTransportId is the
  // source's own stable identifier (ArcGIS OBJECTID). They are expected to
  // move together, but ArcGIS's own pagination sorts by `modified ASC,
  // OBJECTID ASC` — a MUTABLE sort key — so a record edited by the
  // municipality's CMS while a fetch is still paginating can appear on two
  // different pages with two different field snapshots under the SAME
  // OBJECTID. The first pass above cannot catch this: two different
  // snapshots hash to two different fingerprints, so they land in different
  // fingerprint groups and both survive as "unique." Confirmed as the real,
  // reproducible cause of a live production failure (duplicate key on
  // events_provider_provider_transport_id_key, 2026-08-18 18:17 UTC): the DB
  // has UNIQUE(provider, provider_transport_id), and
  // apply_complete_digitel_sync's own insert path never checks
  // provider_transport_id before inserting a "new" event — it only checks
  // occurrence_fingerprint and provider_event_id (which for DigiTel IS the
  // fingerprint), so two same-OBJECTID candidates with different fingerprints
  // both reach INSERT and the second one violates the constraint. Fixed here,
  // client-side, deterministically, before the RPC ever sees a candidate
  // list — not by weakening the DB constraint or by adding a
  // provider_transport_id lookup fallback inside the already-tested,
  // unmodified RPC. Canonical pick: the candidate with the latest
  // sourceUpdatedAt (freshest snapshot of reality), falling back to the same
  // stable ordering used for fingerprint duplicates when sourceUpdatedAt is
  // absent or tied.
  const byTransportId = new Map<string, DigitelEventCandidate[]>();
  for (const candidate of uniqueCandidates) {
    const group = byTransportId.get(candidate.providerTransportId) ?? [];
    group.push(candidate);
    byTransportId.set(candidate.providerTransportId, group);
  }
  const finalCandidates: DigitelEventCandidate[] = [];
  for (const group of byTransportId.values()) {
    if (group.length === 1) {
      finalCandidates.push(group[0]);
      continue;
    }
    const ordered = [...group].sort(compareByFreshnessThenStable);
    const [canonical, ...duplicates] = ordered;
    finalCandidates.push(canonical);
    duplicateRecordCount += duplicates.length;
    duplicateGroups.push({
      occurrenceFingerprint: canonical.occurrenceFingerprint,
      canonicalProviderTransportId: canonical.providerTransportId,
      duplicateProviderTransportIds: duplicates.map((candidate) => candidate.providerTransportId),
      sourceGroupIds: [...new Set(ordered.flatMap((candidate) => candidate.sourceGroupId == null ? [] : [candidate.sourceGroupId]))],
      titles: [...new Set(ordered.map((candidate) => candidate.title))],
    });
  }

  finalCandidates.sort(compareCandidates);
  duplicateGroups.sort((left, right) => left.occurrenceFingerprint.localeCompare(right.occurrenceFingerprint));
  return { uniqueCandidates: finalCandidates, duplicateGroups, duplicateRecordCount };
}

/** Same-transport-id tiebreak: freshest sourceUpdatedAt wins (most current
 *  snapshot of the source record), falling back to the existing stable
 *  ordering when freshness can't decide. */
function compareByFreshnessThenStable(left: DigitelEventCandidate, right: DigitelEventCandidate): number {
  const leftUpdated = left.sourceUpdatedAt ? Date.parse(left.sourceUpdatedAt) : NaN;
  const rightUpdated = right.sourceUpdatedAt ? Date.parse(right.sourceUpdatedAt) : NaN;
  if (Number.isFinite(leftUpdated) && Number.isFinite(rightUpdated) && leftUpdated !== rightUpdated) {
    return rightUpdated - leftUpdated; // later timestamp first
  }
  if (Number.isFinite(leftUpdated) !== Number.isFinite(rightUpdated)) {
    return Number.isFinite(leftUpdated) ? -1 : 1; // a known timestamp beats an unknown one
  }
  return compareCandidates(left, right);
}

export function buildDigitelStagingBundle(input: {
  result: DigitelNormalizationResult;
  sourceValidation: DigitelSourceValidation;
  generatedAt: Date;
  pagesFetched: number;
  requestAttempts: number;
  retryCount: number;
}): { bundle: DigitelStagingBundle; deduplicated: DeduplicatedDigitelCandidates; report: DigitelStagingReport } {
  const deduplicated = deduplicateDigitelCandidates(input.result.candidates);
  const duplicateIds = new Map<string, string>();
  for (const group of deduplicated.duplicateGroups) {
    for (const id of group.duplicateProviderTransportIds) duplicateIds.set(id, group.canonicalProviderTransportId);
  }
  const stagedRecords: DigitelStagedRecord[] = input.result.candidates.map((candidate) => ({
    status: duplicateIds.has(candidate.providerTransportId) ? 'duplicate_review' : 'ready',
    canonicalProviderTransportId: duplicateIds.get(candidate.providerTransportId) ?? candidate.providerTransportId,
    candidate,
  }));
  const generatedAt = input.generatedAt.toISOString();
  const bundle: DigitelStagingBundle = {
    schemaVersion: 1,
    dryRun: true,
    publishedRecords: 0,
    generatedAt,
    source: {
      provider: 'tel_aviv_digitel',
      layerId: 410,
      sourceValidation: input.sourceValidation,
      pagesFetched: input.pagesFetched,
      requestAttempts: input.requestAttempts,
      retryCount: input.retryCount,
    },
    stagedRecords,
    excludedRecords: input.result.excluded,
  };
  const report: DigitelStagingReport = {
    generatedAt,
    dryRun: true,
    publishedRecords: 0,
    sourceValid: input.sourceValidation.valid,
    totalFetched: input.result.candidates.length + input.result.excluded.length,
    normalizedCandidates: input.result.candidates.length,
    uniqueCandidates: deduplicated.uniqueCandidates.length,
    duplicateGroups: deduplicated.duplicateGroups.length,
    duplicateRecords: deduplicated.duplicateRecordCount,
    excludedRecords: input.result.excluded.length,
    readyForReview: deduplicated.uniqueCandidates.length,
    pagesFetched: input.pagesFetched,
    requestAttempts: input.requestAttempts,
    retryCount: input.retryCount,
  };
  return { bundle, deduplicated, report };
}

export function buildDigitelQualityReport(candidates: readonly DigitelEventCandidate[], generatedAt = new Date()): DigitelQualityReport {
  const scored = candidates.map(scoreDigitelCandidate);
  const issues = emptyIssueCounts();
  const bands = { high: 0, medium: 0, low: 0 };
  for (const candidate of scored) {
    bands[candidate.band] += 1;
    for (const issue of candidate.issues) issues[issue] += 1;
  }
  const averageScore = scored.length === 0 ? 0 : Math.round((scored.reduce((sum, candidate) => sum + candidate.score, 0) / scored.length) * 10) / 10;
  return { generatedAt: generatedAt.toISOString(), candidateCount: scored.length, averageScore, bands, issues, candidates: scored };
}

export function scoreDigitelCandidate(candidate: DigitelEventCandidate): DigitelCandidateQuality {
  const issues: DigitelQualityIssue[] = [];
  if (!candidate.description) issues.push('missing_description');
  if (!candidate.locationName) issues.push('missing_location');
  if (!candidate.sourceUrl) issues.push('missing_source_url');
  if (!candidate.imageUrl) issues.push('missing_image_url');
  if (!candidate.sourceUpdatedAt) issues.push('missing_source_updated_at');
  const weights: Record<DigitelQualityIssue, number> = {
    missing_description: 20,
    missing_location: 20,
    missing_source_url: 20,
    missing_image_url: 15,
    missing_source_updated_at: 25,
  };
  const score = Math.max(0, 100 - issues.reduce((sum, issue) => sum + weights[issue], 0));
  return {
    providerTransportId: candidate.providerTransportId,
    occurrenceFingerprint: candidate.occurrenceFingerprint,
    score,
    band: score >= 80 ? 'high' : score >= 50 ? 'medium' : 'low',
    issues,
  };
}

function compareCandidates(left: DigitelEventCandidate, right: DigitelEventCandidate): number {
  const leftId = Number(left.providerTransportId);
  const rightId = Number(right.providerTransportId);
  if (Number.isFinite(leftId) && Number.isFinite(rightId) && leftId !== rightId) return leftId - rightId;
  return left.providerTransportId.localeCompare(right.providerTransportId);
}

function emptyIssueCounts(): Record<DigitelQualityIssue, number> {
  return {
    missing_description: 0,
    missing_location: 0,
    missing_source_url: 0,
    missing_image_url: 0,
    missing_source_updated_at: 0,
  };
}
