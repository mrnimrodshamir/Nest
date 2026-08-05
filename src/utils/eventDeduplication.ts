import type { EventImportRecord } from '@/utils/eventMapping';

export type EventDuplicateReason = 'provider_identity' | 'occurrence_identity' | 'content_match';

export interface EventDuplicateMatch {
  canonicalOccurrenceId: string;
  candidateOccurrenceId: string;
  reason: EventDuplicateReason;
  confidence: 'exact' | 'probable';
}

export interface EventDeduplicationResult {
  accepted: EventImportRecord[];
  exactDuplicates: EventDuplicateMatch[];
  manualReview: EventDuplicateMatch[];
}

export function deduplicateEventImports(records: readonly EventImportRecord[]): EventDeduplicationResult {
  const ordered = [...records].sort((left, right) => left.occurrence.id.localeCompare(right.occurrence.id));
  const accepted: EventImportRecord[] = [];
  const exactDuplicates: EventDuplicateMatch[] = [];
  const manualReview: EventDuplicateMatch[] = [];
  const providerOccurrenceKeys = new Map<string, EventImportRecord>();
  const occurrenceIds = new Map<string, EventImportRecord>();

  for (const record of ordered) {
    const providerOccurrenceKey = record.occurrence.providerOccurrenceId == null
      ? null
      : `${record.event.source.provider}\u0000${record.event.source.providerEventId}\u0000${record.occurrence.providerOccurrenceId}`;
    const providerDuplicate = providerOccurrenceKey == null ? undefined : providerOccurrenceKeys.get(providerOccurrenceKey);
    const occurrenceDuplicate = occurrenceIds.get(record.occurrence.id);
    const exact = providerDuplicate ?? occurrenceDuplicate;
    if (exact) {
      exactDuplicates.push({
        canonicalOccurrenceId: exact.occurrence.id,
        candidateOccurrenceId: record.occurrence.id,
        reason: providerDuplicate ? 'provider_identity' : 'occurrence_identity',
        confidence: 'exact',
      });
      continue;
    }

    const probable = accepted.find((candidate) => isProbableContentMatch(candidate, record));
    if (probable) {
      manualReview.push({
        canonicalOccurrenceId: probable.occurrence.id,
        candidateOccurrenceId: record.occurrence.id,
        reason: 'content_match',
        confidence: 'probable',
      });
      continue;
    }
    accepted.push(record);
    if (providerOccurrenceKey != null) providerOccurrenceKeys.set(providerOccurrenceKey, record);
    occurrenceIds.set(record.occurrence.id, record);
  }
  return { accepted, exactDuplicates, manualReview };
}

function isProbableContentMatch(left: EventImportRecord, right: EventImportRecord): boolean {
  if (normalizeText(left.event.title) !== normalizeText(right.event.title)) return false;
  if (Math.abs(Date.parse(left.occurrence.startsAt) - Date.parse(right.occurrence.startsAt)) > 15 * 60 * 1_000) return false;
  return distanceMeters(left.event.location, right.event.location) <= 100;
}

function normalizeText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('he').replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/gu, ' ').trim();
}

function distanceMeters(left: { latitude: number; longitude: number }, right: { latitude: number; longitude: number }): number {
  const toRadians = (degrees: number) => degrees * Math.PI / 180;
  const latitudeDelta = toRadians(right.latitude - left.latitude);
  const longitudeDelta = toRadians(right.longitude - left.longitude);
  const a = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(toRadians(left.latitude)) * Math.cos(toRadians(right.latitude)) * Math.sin(longitudeDelta / 2) ** 2;
  return 6_371_000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
