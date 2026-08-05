import type { DigitelEventCandidate } from '@/integrations/digitelConnector';
import type { EventImportRecord } from '@/utils/eventMapping';
import { createEventOccurrenceFingerprint, createEventOccurrenceId } from '@/utils/eventIdentity';

export function mapDigitelCandidateToEvent(candidate: DigitelEventCandidate): EventImportRecord {
  const occurrenceId = createEventOccurrenceId({
    provider: candidate.provider,
    providerEventId: candidate.providerEventId,
    startsAt: candidate.startTime,
  });
  const fingerprint = createEventOccurrenceFingerprint({
    title: candidate.title,
    startsAt: candidate.startTime,
    locationName: candidate.locationName,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
  });
  return {
    event: {
      title: candidate.title,
      description: candidate.description,
      category: candidate.category,
      imageUrl: candidate.imageUrl,
      ageMinMonths: candidate.ageMinMonths,
      ageMaxMonths: candidate.ageMaxMonths,
      priceNote: candidate.price,
      registrationRequired: candidate.registrationRequired,
      registrationUrl: candidate.registrationUrl,
      verificationStatus: 'staged',
      publicationStatus: 'staged',
      status: 'scheduled',
      cancellationReason: null,
      source: {
        provider: candidate.provider,
        providerEventId: candidate.providerEventId,
        providerTransportId: candidate.providerTransportId,
        sourceGroupId: candidate.sourceGroupId,
        sourceName: 'Tel Aviv DigiTel',
        sourceUrl: candidate.sourceUrl,
        sourcePublishedAt: candidate.sourcePublishedAt,
        sourceUpdatedAt: candidate.sourceUpdatedAt,
        providerMetadata: {},
      },
      recurrence: {
        isRecurring: candidate.recurring === true,
        rule: null,
        timezone: 'Asia/Jerusalem',
        seriesId: candidate.sourceGroupId,
      },
      location: {
        placeId: null,
        name: candidate.locationName,
        formattedAddress: null,
        latitude: candidate.latitude,
        longitude: candidate.longitude,
      },
      deduplicationKey: fingerprint,
    },
    occurrence: {
      id: occurrenceId,
      providerOccurrenceId: candidate.providerTransportId,
      occurrenceFingerprint: fingerprint,
      startsAt: candidate.startTime,
      endsAt: candidate.endTime,
      originalStartsAt: null,
      status: 'scheduled',
      cancellationReason: null,
      sourceUpdatedAt: candidate.sourceUpdatedAt,
      providerMetadata: {},
    },
  };
}
