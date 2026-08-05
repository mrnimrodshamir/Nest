import type {
  EventCategory,
  EventDetails,
  EventEntity,
  EventOccurrence,
  EventPublicationStatus,
  EventSourceStatus,
  EventVerificationStatus,
} from '@/types/event';
import { isEventCategory } from '@/types/event';
import { resolveEventLifecycle } from '@/utils/eventLifecycle';

export type EventImportEntity = Omit<EventEntity, 'id' | 'createdAt' | 'updatedAt'> & {
  deduplicationKey: string;
};
export type EventImportOccurrence = Omit<EventOccurrence, 'eventId'>;

export interface EventImportRecord {
  event: EventImportEntity;
  occurrence: EventImportOccurrence;
}

export interface EventRow {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  image_url: string | null;
  age_min_months: number | null;
  age_max_months: number | null;
  price_note: string | null;
  registration_required: boolean | null;
  registration_url: string | null;
  verification_status: string;
  publication_status: string;
  event_status: string;
  cancellation_reason: string | null;
  provider: string;
  provider_event_id: string;
  provider_transport_id: string | null;
  source_group_id: string | null;
  source_name: string | null;
  source_url: string | null;
  source_published_at: string | null;
  source_updated_at: string | null;
  provider_metadata: Record<string, unknown> | null;
  is_recurring: boolean;
  recurrence_rule: string | null;
  recurrence_timezone: string;
  recurrence_series_id: string | null;
  place_id: string | null;
  location_name: string | null;
  formatted_address: string | null;
  latitude: number;
  longitude: number;
  created_at: string;
  updated_at: string;
}

export interface EventOccurrenceRow {
  id: string;
  event_id: string;
  provider_occurrence_id: string | null;
  occurrence_fingerprint: string;
  starts_at: string;
  ends_at: string | null;
  original_starts_at: string | null;
  occurrence_status: string;
  cancellation_reason: string | null;
  source_updated_at: string | null;
  provider_metadata: Record<string, unknown> | null;
}

export function mapEventDetails(eventRow: EventRow, occurrenceRow: EventOccurrenceRow, now = new Date()): EventDetails {
  if (occurrenceRow.event_id !== eventRow.id) throw new Error('Event occurrence does not belong to event');
  const eventStatus = parseSourceStatus(eventRow.event_status);
  const occurrenceStatus = parseSourceStatus(occurrenceRow.occurrence_status);
  const entity: EventEntity = {
    id: eventRow.id,
    title: requireText(eventRow.title, 'title'),
    description: eventRow.description,
    category: parseCategory(eventRow.category),
    imageUrl: eventRow.image_url,
    ageMinMonths: eventRow.age_min_months,
    ageMaxMonths: eventRow.age_max_months,
    priceNote: eventRow.price_note,
    registrationRequired: eventRow.registration_required,
    registrationUrl: eventRow.registration_url,
    verificationStatus: parseVerificationStatus(eventRow.verification_status),
    publicationStatus: parsePublicationStatus(eventRow.publication_status),
    status: eventStatus,
    cancellationReason: eventRow.cancellation_reason,
    source: {
      provider: requireText(eventRow.provider, 'provider'),
      providerEventId: requireText(eventRow.provider_event_id, 'provider_event_id'),
      providerTransportId: eventRow.provider_transport_id,
      sourceGroupId: eventRow.source_group_id,
      sourceName: eventRow.source_name,
      sourceUrl: eventRow.source_url,
      sourcePublishedAt: eventRow.source_published_at,
      sourceUpdatedAt: eventRow.source_updated_at,
      providerMetadata: safeMetadata(eventRow.provider_metadata),
    },
    recurrence: {
      isRecurring: eventRow.is_recurring,
      rule: eventRow.recurrence_rule,
      timezone: requireText(eventRow.recurrence_timezone, 'recurrence_timezone'),
      seriesId: eventRow.recurrence_series_id,
    },
    location: {
      placeId: eventRow.place_id,
      name: eventRow.location_name,
      formattedAddress: eventRow.formatted_address,
      latitude: validateCoordinate(eventRow.latitude, -90, 90, 'latitude'),
      longitude: validateCoordinate(eventRow.longitude, -180, 180, 'longitude'),
    },
    createdAt: eventRow.created_at,
    updatedAt: eventRow.updated_at,
  };
  const occurrence: EventOccurrence = {
    id: requireText(occurrenceRow.id, 'occurrence id'),
    eventId: occurrenceRow.event_id,
    providerOccurrenceId: occurrenceRow.provider_occurrence_id,
    occurrenceFingerprint: requireText(occurrenceRow.occurrence_fingerprint, 'occurrence fingerprint'),
    startsAt: occurrenceRow.starts_at,
    endsAt: occurrenceRow.ends_at,
    originalStartsAt: occurrenceRow.original_starts_at,
    status: occurrenceStatus,
    cancellationReason: occurrenceRow.cancellation_reason,
    sourceUpdatedAt: occurrenceRow.source_updated_at,
    providerMetadata: safeMetadata(occurrenceRow.provider_metadata),
  };
  return {
    ...entity,
    occurrence,
    lifecycle: resolveEventLifecycle({
      eventStatus,
      occurrenceStatus,
      startsAt: occurrence.startsAt,
      endsAt: occurrence.endsAt,
      timezone: entity.recurrence.timezone,
    }, now),
  };
}

function parseCategory(value: string | null): EventCategory | null {
  if (value == null) return null;
  if (!isEventCategory(value)) throw new Error(`Unsupported event category: ${value}`);
  return value;
}

function parseSourceStatus(value: string): EventSourceStatus {
  if (value === 'scheduled' || value === 'cancelled' || value === 'postponed') return value;
  throw new Error(`Unsupported event status: ${value}`);
}

function parseVerificationStatus(value: string): EventVerificationStatus {
  if (value === 'staged' || value === 'needs_review' || value === 'verified' || value === 'rejected') return value;
  throw new Error(`Unsupported event verification status: ${value}`);
}

function parsePublicationStatus(value: string): EventPublicationStatus {
  if (value === 'staged' || value === 'published' || value === 'archived') return value;
  throw new Error(`Unsupported event publication status: ${value}`);
}

function safeMetadata(value: Record<string, unknown> | null): Record<string, unknown> {
  return value && !Array.isArray(value) ? value : {};
}

function requireText(value: string, field: string): string {
  if (!value?.trim()) throw new Error(`Missing event ${field}`);
  return value;
}

function validateCoordinate(value: number, minimum: number, maximum: number, field: string): number {
  if (!Number.isFinite(value) || value < minimum || value > maximum) throw new Error(`Invalid event ${field}`);
  return value;
}
