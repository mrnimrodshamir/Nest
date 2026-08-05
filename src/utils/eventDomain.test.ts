import assert from 'node:assert/strict';
import test from 'node:test';
import type { DigitelEventCandidate } from '@/integrations/digitelConnector';
import { mapDigitelCandidateToEvent } from '@/integrations/digitelEventMapping';
import { deduplicateEventImports } from '@/utils/eventDeduplication';
import { createEventOccurrenceFingerprint, createEventOccurrenceId } from '@/utils/eventIdentity';
import { mapEventDetails, type EventOccurrenceRow, type EventRow } from '@/utils/eventMapping';

function candidate(overrides: Partial<DigitelEventCandidate> = {}): DigitelEventCandidate {
  return {
    provider: 'tel_aviv_digitel', providerEventId: 'source-1', providerTransportId: '101', sourceGroupId: '7',
    title: 'שעת סיפור', description: 'אירוע למשפחות', sourceType: 'אירועים בתוקף', sourceUrl: 'https://example.com/event',
    startTime: '2026-08-06T15:00:00.000Z', endTime: null, recurring: null, ageMinMonths: null, ageMaxMonths: null,
    category: null, locationName: 'ספרייה', latitude: 32.081, longitude: 34.781, price: null,
    registrationRequired: null, registrationUrl: null, imageUrl: 'https://example.com/image.jpg', iconUrl: null,
    cancellationStatus: null, sourcePublishedAt: null, sourceUpdatedAt: null,
    occurrenceFingerprint: 'digitel-v1-source', occurrenceIdentityKey: 'source', ...overrides,
  };
}

test('occurrence IDs and fingerprints are deterministic and provider-neutral', () => {
  const input = { provider: 'Tel_Aviv_DigiTel', providerEventId: ' ABC ', startsAt: '2026-08-06T15:00:00+00:00' };
  assert.equal(createEventOccurrenceId(input), createEventOccurrenceId({ ...input, provider: 'tel_aviv_digitel', providerEventId: 'abc' }));
  assert.match(createEventOccurrenceId(input), /^event-occ-v1-[0-9a-f]{16}$/);
  const fingerprint = createEventOccurrenceFingerprint({ title: 'שעת סיפור!', startsAt: input.startsAt, locationName: 'ספרייה', latitude: 32.081, longitude: 34.781 });
  assert.match(fingerprint, /^event-fp-v1-[0-9a-f]{16}$/);
  assert.throws(() => createEventOccurrenceFingerprint({ title: 'x', startsAt: input.startsAt, locationName: null, latitude: 200, longitude: 0 }), /coordinates/);
});

test('DigiTel candidates map into staged Events without inferring unsupported claims', () => {
  const mapped = mapDigitelCandidateToEvent(candidate());
  assert.equal(mapped.event.publicationStatus, 'staged');
  assert.equal(mapped.event.verificationStatus, 'staged');
  assert.equal(mapped.event.category, null);
  assert.equal(mapped.event.recurrence.isRecurring, false);
  assert.equal(mapped.event.recurrence.rule, null);
  assert.equal(mapped.occurrence.endsAt, null);
  assert.equal(mapped.occurrence.providerOccurrenceId, '101');
  assert.deepEqual(mapped.event.source.providerMetadata, {});
});

test('deduplication separates exact source duplicates from probable content matches', () => {
  const exactA = mapDigitelCandidateToEvent(candidate());
  const exactB = mapDigitelCandidateToEvent(candidate({ providerTransportId: '102' }));
  const probable = mapDigitelCandidateToEvent(candidate({ provider: 'municipality_calendar', providerEventId: 'other-1', providerTransportId: '501' }));
  const result = deduplicateEventImports([probable, exactB, exactA]);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.exactDuplicates.length, 1);
  assert.equal(result.exactDuplicates[0].reason, 'occurrence_identity');
  assert.equal(result.manualReview.length, 1);
  assert.equal(result.manualReview[0].reason, 'content_match');
});

test('recurring provider events retain distinct occurrences', () => {
  const first = mapDigitelCandidateToEvent(candidate({ providerEventId: 'series-1', providerTransportId: 'occ-1' }));
  const second = mapDigitelCandidateToEvent(candidate({
    providerEventId: 'series-1', providerTransportId: 'occ-2', startTime: '2026-08-13T15:00:00.000Z',
  }));
  const result = deduplicateEventImports([second, first]);
  assert.equal(result.accepted.length, 2);
  assert.equal(result.exactDuplicates.length, 0);
  assert.equal(result.manualReview.length, 0);
});

test('a reused provider occurrence ID is held as an exact duplicate', () => {
  const first = mapDigitelCandidateToEvent(candidate({ providerEventId: 'series-1', providerTransportId: 'occ-1' }));
  const reused = mapDigitelCandidateToEvent(candidate({
    providerEventId: 'series-1', providerTransportId: 'occ-1', startTime: '2026-08-13T15:00:00.000Z',
  }));
  const result = deduplicateEventImports([first, reused]);
  assert.equal(result.accepted.length, 1);
  assert.equal(result.exactDuplicates[0].reason, 'provider_identity');
});

test('database mapping validates ownership and derives cancellation lifecycle', () => {
  const rows = eventRows();
  rows.occurrence.occurrence_status = 'cancelled';
  rows.occurrence.cancellation_reason = 'Venue unavailable';
  const detail = mapEventDetails(rows.event, rows.occurrence, new Date('2026-08-06T15:30:00Z'));
  assert.equal(detail.lifecycle, 'cancelled');
  assert.equal(detail.occurrence.cancellationReason, 'Venue unavailable');
  assert.deepEqual(detail.source.providerMetadata, { feed: 'official' });
  assert.throws(() => mapEventDetails(rows.event, { ...rows.occurrence, event_id: 'other' }), /does not belong/);
});

function eventRows(): { event: EventRow; occurrence: EventOccurrenceRow } {
  const event: EventRow = {
    id: '00000000-0000-4000-8000-000000000001', title: 'Story time', description: 'For families', category: 'story_time',
    image_url: null, age_min_months: null, age_max_months: null, price_note: null, registration_required: false,
    registration_url: null, verification_status: 'verified', publication_status: 'published', event_status: 'scheduled',
    cancellation_reason: null, provider: 'tel_aviv_digitel', provider_event_id: 'source-1', provider_transport_id: '101',
    source_group_id: '7', source_name: 'Tel Aviv DigiTel', source_url: 'https://example.com/event', source_published_at: null,
    source_updated_at: null, provider_metadata: { feed: 'official' }, is_recurring: false, recurrence_rule: null,
    recurrence_timezone: 'Asia/Jerusalem', recurrence_series_id: null, place_id: null, location_name: 'Library',
    formatted_address: 'Tel Aviv', latitude: 32.081, longitude: 34.781, created_at: '2026-08-01T00:00:00Z', updated_at: '2026-08-01T00:00:00Z',
  };
  const occurrence: EventOccurrenceRow = {
    id: 'event-occ-v1-0123456789abcdef', event_id: event.id, provider_occurrence_id: '101',
    occurrence_fingerprint: 'event-fp-v1-0123456789abcdef', starts_at: '2026-08-06T15:00:00Z', ends_at: '2026-08-06T16:00:00Z',
    original_starts_at: null, occurrence_status: 'scheduled', cancellation_reason: null, source_updated_at: null, provider_metadata: {},
  };
  return { event, occurrence };
}
