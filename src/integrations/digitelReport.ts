import type { ArcGisFeature, DigitelEventCandidate, DigitelNormalizationResult, ExcludedDigitelRecord } from '@/integrations/digitelConnector';
import { groupFingerprintCollisions, mapSourceRecord } from '@/integrations/digitelConnector';

export interface DigitelDryRunReport {
  generatedAt: string;
  totalFetched: number;
  eventRecords: number;
  excludedRecords: number;
  excludedRecordDetails: ExcludedDigitelRecord[];
  exclusionsByReason: Record<string, number>;
  noticeRecordsExcluded: number;
  invalidDateRecords: number;
  missingTitleRecords: number;
  validCoordinateRecords: number;
  uniqueObjectIds: number;
  uniqueNbrIds: number;
  fingerprintDuplicateGroups: number;
  fingerprintDuplicateRecords: number;
  futureEventCount: number;
  eventsByType: Record<string, number>;
  eventsByMonth: Record<string, number>;
  sourceMissingFields: Record<string, number>;
  normalizedCompleteness: Record<string, { present: number; missing: number }>;
  images: {
    imageUrlPresent: number;
    validHttps: number;
    invalidOrNonHttps: number;
    duplicateUrlGroups: number;
    duplicateUrlRecords: number;
    domains: Record<string, number>;
    sourcePagePresent: number;
    sourcePageValidHttps: number;
    documentedReuseTerms: false;
    reachability: 'not-fetched';
  };
  duplicateGroups: Array<{ fingerprint: string; objectIds: string[]; titles: string[] }>;
  sampleCandidates: DigitelEventCandidate[];
}

export function buildDigitelDryRunReport(
  features: readonly ArcGisFeature[],
  result: DigitelNormalizationResult,
  generatedAt = new Date(),
): DigitelDryRunReport {
  const sourceRows = features.map(mapSourceRecord);
  const objectIds = new Set(sourceRows.flatMap((row) => row.objectId == null ? [] : [row.objectId]));
  const nbrIds = new Set(sourceRows.flatMap((row) => row.sourceGroupId == null ? [] : [row.sourceGroupId]));
  const collisions = groupFingerprintCollisions(result.candidates);
  const images = analyzeUrls(sourceRows.map((row) => row.imageUrl), sourceRows.map((row) => row.sourceUrl));
  const now = generatedAt.getTime();

  return {
    generatedAt: generatedAt.toISOString(),
    totalFetched: features.length,
    eventRecords: result.candidates.length,
    excludedRecords: result.excluded.length,
    excludedRecordDetails: result.excluded,
    exclusionsByReason: countValues(result.excluded.flatMap((row) => row.reasons)),
    noticeRecordsExcluded: result.excluded.filter((row) => row.reasons.includes('notice')).length,
    invalidDateRecords: result.excluded.filter((row) => row.reasons.includes('invalid_or_implausible_start_date')).length,
    missingTitleRecords: result.excluded.filter((row) => row.reasons.includes('missing_title')).length,
    validCoordinateRecords: sourceRows.filter((row) => row.latitude != null && row.longitude != null && row.latitude >= -90 && row.latitude <= 90 && row.longitude >= -180 && row.longitude <= 180).length,
    uniqueObjectIds: objectIds.size,
    uniqueNbrIds: nbrIds.size,
    fingerprintDuplicateGroups: collisions.length,
    fingerprintDuplicateRecords: collisions.reduce((sum, group) => sum + group.length, 0),
    futureEventCount: result.candidates.filter((candidate) => new Date(candidate.startTime).getTime() > now).length,
    eventsByType: countValues(result.candidates.map((candidate) => candidate.sourceType ?? 'missing')),
    eventsByMonth: countValues(result.candidates.map((candidate) => candidate.startTime.slice(0, 7))),
    sourceMissingFields: {
      OBJECTID: sourceRows.filter((row) => row.objectId == null).length,
      title: sourceRows.filter((row) => !row.title?.trim()).length,
      startdate: sourceRows.filter((row) => row.startDate == null).length,
      location: sourceRows.filter((row) => !row.location?.trim()).length,
      type: sourceRows.filter((row) => !row.type?.trim()).length,
      NbrId: sourceRows.filter((row) => row.sourceGroupId == null).length,
      description: sourceRows.filter((row) => !row.description?.trim()).length,
      summary: sourceRows.filter((row) => !row.summary?.trim()).length,
      image_url: sourceRows.filter((row) => !row.imageUrl?.trim()).length,
      icon_url: sourceRows.filter((row) => !row.iconUrl?.trim()).length,
      sitemapurl: sourceRows.filter((row) => !row.sourceUrl?.trim()).length,
      modified: sourceRows.filter((row) => row.modified == null).length,
      publishdate: sourceRows.filter((row) => row.publishDate == null).length,
      coordinates: sourceRows.filter((row) => row.latitude == null || row.longitude == null).length,
    },
    normalizedCompleteness: completeness(result.candidates),
    images,
    duplicateGroups: collisions.map((group) => ({
      fingerprint: group[0].occurrenceFingerprint,
      objectIds: group.map((candidate) => candidate.providerTransportId),
      titles: [...new Set(group.map((candidate) => candidate.title))],
    })),
    sampleCandidates: result.candidates.slice(0, 20),
  };
}

function analyzeUrls(imageValues: Array<string | null>, sourceValues: Array<string | null>): DigitelDryRunReport['images'] {
  const presentImages = imageValues.filter((value): value is string => Boolean(value?.trim()));
  const validImages = presentImages.flatMap((value) => validHttpsUrl(value) ? [new URL(value).toString()] : []);
  const groups = new Map<string, number>();
  for (const url of validImages) groups.set(url, (groups.get(url) ?? 0) + 1);
  const duplicateGroups = [...groups.values()].filter((count) => count > 1);
  const domains = countValues(validImages.map((value) => new URL(value).hostname.toLocaleLowerCase('en')));
  const presentSources = sourceValues.filter((value): value is string => Boolean(value?.trim()));
  return {
    imageUrlPresent: presentImages.length,
    validHttps: validImages.length,
    invalidOrNonHttps: presentImages.length - validImages.length,
    duplicateUrlGroups: duplicateGroups.length,
    duplicateUrlRecords: duplicateGroups.reduce((sum, count) => sum + count, 0),
    domains,
    sourcePagePresent: presentSources.length,
    sourcePageValidHttps: presentSources.filter(validHttpsUrl).length,
    documentedReuseTerms: false,
    reachability: 'not-fetched',
  };
}

function validHttpsUrl(value: string): boolean {
  try { return new URL(value.trim()).protocol === 'https:'; } catch { return false; }
}

function countValues(values: readonly string[]): Record<string, number> {
  const result: Record<string, number> = {};
  for (const value of values) result[value] = (result[value] ?? 0) + 1;
  return Object.fromEntries(Object.entries(result).sort(([left], [right]) => left.localeCompare(right)));
}

function completeness(candidates: readonly DigitelEventCandidate[]): Record<string, { present: number; missing: number }> {
  const fields: Array<keyof DigitelEventCandidate> = [
    'title', 'description', 'sourceUrl', 'startTime', 'endTime', 'locationName', 'imageUrl',
    'ageMinMonths', 'ageMaxMonths', 'category', 'price', 'registrationRequired', 'registrationUrl',
    'sourcePublishedAt', 'sourceUpdatedAt',
  ];
  return Object.fromEntries(fields.map((field) => {
    const present = candidates.filter((candidate) => candidate[field] != null && candidate[field] !== '').length;
    return [field, { present, missing: candidates.length - present }];
  }));
}
