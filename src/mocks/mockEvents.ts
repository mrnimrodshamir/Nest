import type { EventDetails } from '@/types/event';

export const MOCK_EVENTS: EventDetails[] = [
  mockEvent('event-occ-v1-1111111111111111', 'Family story time', 'story_time', '2026-08-06T14:00:00.000Z', 32.081, 34.781),
  mockEvent('event-occ-v1-2222222222222222', 'Creative workshop', 'workshop', '2026-08-07T08:00:00.000Z', 32.086, 34.777),
];

function mockEvent(id: string, title: string, category: EventDetails['category'], startsAt: string, latitude: number, longitude: number): EventDetails {
  const eventId = `mock-${id}`;
  return {
    id: eventId, title, description: 'An official family event in Tel Aviv.', category, imageUrl: null,
    ageMinMonths: null, ageMaxMonths: null, priceNote: null, registrationRequired: false, registrationUrl: null,
    verificationStatus: 'verified', publicationStatus: 'published', status: 'scheduled', cancellationReason: null,
    source: { provider: 'preview', providerEventId: eventId, providerTransportId: null, sourceGroupId: null, sourceName: 'Tel Aviv Municipality', sourceUrl: null, sourcePublishedAt: null, sourceUpdatedAt: null, providerMetadata: {} },
    recurrence: { isRecurring: false, rule: null, timezone: 'Asia/Jerusalem', seriesId: null },
    location: { placeId: null, name: 'Tel Aviv', formattedAddress: null, latitude, longitude },
    occurrence: { id, eventId, providerOccurrenceId: null, occurrenceFingerprint: `event-fp-v1-${id.slice(-16)}`, startsAt, endsAt: null, originalStartsAt: null, status: 'scheduled', cancellationReason: null, sourceUpdatedAt: null, providerMetadata: {} },
    lifecycle: 'upcoming', createdAt: '2026-08-05T00:00:00.000Z', updatedAt: '2026-08-05T00:00:00.000Z',
  };
}
