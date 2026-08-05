import type {
  DigitelEventCandidate,
  DigitelNormalizationResult,
  DigitelSourceValidation,
  ExcludedDigitelRecord,
} from '@/integrations/digitelConnector';

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

  uniqueCandidates.sort(compareCandidates);
  duplicateGroups.sort((left, right) => left.occurrenceFingerprint.localeCompare(right.occurrenceFingerprint));
  return { uniqueCandidates, duplicateGroups, duplicateRecordCount };
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
