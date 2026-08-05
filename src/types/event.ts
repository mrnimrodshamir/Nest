export const EVENT_CATEGORIES = [
  'story_time',
  'workshop',
  'performance',
  'festival',
  'museum',
  'library',
  'park',
  'sports',
  'community',
  'animals',
  'other',
] as const;

export type EventCategory = (typeof EVENT_CATEGORIES)[number];
export type EventVerificationStatus = 'staged' | 'needs_review' | 'verified' | 'rejected';
export type EventPublicationStatus = 'staged' | 'published' | 'archived';
export type EventSourceStatus = 'scheduled' | 'cancelled' | 'postponed';
export type EventLifecycleStatus = 'upcoming' | 'today' | 'live' | 'finished' | 'cancelled' | 'postponed';

export interface EventSourceMetadata {
  provider: string;
  providerEventId: string;
  providerTransportId: string | null;
  sourceGroupId: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  sourcePublishedAt: string | null;
  sourceUpdatedAt: string | null;
  /** Provider-specific metadata is server/admin-only and must contain no credentials. */
  providerMetadata: Record<string, unknown>;
}

export interface EventRecurrence {
  isRecurring: boolean;
  /** RFC 5545 RRULE when the source supplies one. Never inferred. */
  rule: string | null;
  timezone: string;
  seriesId: string | null;
}

export interface EventLocation {
  placeId: string | null;
  name: string | null;
  formattedAddress: string | null;
  latitude: number;
  longitude: number;
}

export interface EventOccurrence {
  id: string;
  eventId: string;
  providerOccurrenceId: string | null;
  occurrenceFingerprint: string;
  startsAt: string;
  endsAt: string | null;
  originalStartsAt: string | null;
  status: EventSourceStatus;
  cancellationReason: string | null;
  sourceUpdatedAt: string | null;
  providerMetadata: Record<string, unknown>;
}

export interface EventEntity {
  id: string;
  title: string;
  description: string | null;
  category: EventCategory | null;
  imageUrl: string | null;
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  priceNote: string | null;
  registrationRequired: boolean | null;
  registrationUrl: string | null;
  verificationStatus: EventVerificationStatus;
  publicationStatus: EventPublicationStatus;
  status: EventSourceStatus;
  cancellationReason: string | null;
  source: EventSourceMetadata;
  recurrence: EventRecurrence;
  location: EventLocation;
  createdAt: string;
  updatedAt: string;
}

export interface EventDetails extends EventEntity {
  occurrence: EventOccurrence;
  lifecycle: EventLifecycleStatus;
}

export const EVENT_CATEGORY_LABELS: Record<EventCategory, string> = {
  story_time: 'Story time',
  workshop: 'Workshop',
  performance: 'Performance',
  festival: 'Festival',
  museum: 'Museum',
  library: 'Library',
  park: 'Park',
  sports: 'Sports',
  community: 'Community',
  animals: 'Animals',
  other: 'Other',
};

export function isEventCategory(value: string): value is EventCategory {
  return (EVENT_CATEGORIES as readonly string[]).includes(value);
}
