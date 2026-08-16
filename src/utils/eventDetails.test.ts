import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import type { EventDetails } from '@/types/event';
import { buildEventDetailsPresentation } from '@/utils/eventPresentation';

function detail(): EventDetails {
  return {
    id: 'event-1', title: 'Story time', description: 'For families', category: 'story_time', imageUrl: null,
    ageMinMonths: null, ageMaxMonths: null, priceNote: null, registrationRequired: true,
    registrationUrl: 'https://example.com/register', verificationStatus: 'verified', publicationStatus: 'published',
    status: 'scheduled', cancellationReason: null,
    source: {
      provider: 'tel_aviv_digitel', providerEventId: 'source-1', providerTransportId: '101', sourceGroupId: '7',
      sourceName: 'Tel Aviv DigiTel', sourceUrl: 'https://example.com/event', sourcePublishedAt: null, sourceUpdatedAt: null,
      providerMetadata: { internal: 'must not render' },
    },
    recurrence: { isRecurring: true, rule: 'FREQ=WEEKLY', timezone: 'Asia/Jerusalem', seriesId: '7' },
    location: { placeId: null, name: 'Library', formattedAddress: 'Tel Aviv', latitude: 32.081, longitude: 34.781 },
    createdAt: '2026-08-01T00:00:00Z', updatedAt: '2026-08-01T00:00:00Z', lifecycle: 'cancelled',
    occurrence: {
      id: 'event-occ-v1-0123456789abcdef', eventId: 'event-1', providerOccurrenceId: '101',
      occurrenceFingerprint: 'event-fp-v1-0123456789abcdef', startsAt: '2026-08-06T15:00:00Z', endsAt: '2026-08-06T16:00:00Z',
      originalStartsAt: null, status: 'cancelled', cancellationReason: 'Venue unavailable', sourceUpdatedAt: null,
      providerMetadata: {},
    },
  };
}

test('Event Details presentation shows recurrence, source and cancellation without raw provider metadata', () => {
  const presentation = buildEventDetailsPresentation(detail());
  assert.equal(presentation.recurrenceLabel, 'Part of a recurring series');
  assert.equal(presentation.cancellationMessage, 'Venue unavailable');
  assert.equal(presentation.sourceLabel, 'Source: Tel Aviv DigiTel');
  assert.equal(presentation.registrationLabel, 'Registration required');
  assert.equal(JSON.stringify(presentation).includes('must not render'), false);
});

test('Event Details accepts an official source URL without a source display name', () => {
  const event = detail();
  event.source.sourceName = null;
  assert.equal(buildEventDetailsPresentation(event).sourceLabel, 'Official source');
});

test('Event Details uses the shared root stack and Discovery without a competing Events screen', async () => {
  const screen = await readFile(new URL('../screens/EventDetailsScreen.tsx', import.meta.url), 'utf8');
  const app = await readFile(new URL('../../App.tsx', import.meta.url), 'utf8');
  const discovery = await readFile(new URL('../screens/DiscoverScreen.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(screen, /ActivityCard|PlaceCard|DiscoverScreen/);
  assert.match(app, /EventDetailsScreen/);
  assert.match(app, /EventDetails: \{ occurrenceId: string \}/);
  assert.match(discovery, /EventCard/);
  assert.doesNotMatch(discovery, /EventsDiscoveryScreen|EventsDiscoveryView/);
});

test('Event Details opening is fail-closed against native map and provider-image crashes', async () => {
  const screen = await readFile(new URL('../screens/EventDetailsScreen.tsx', import.meta.url), 'utf8');
  const discovery = await readFile(new URL('../screens/DiscoverScreen.tsx', import.meta.url), 'utf8');
  assert.match(discovery, /useIsFocused\(\)/);
  assert.match(discovery, /key=\{`discovery-map-\$\{mapGeneration\}`\}/);
  assert.match(discovery, /nextDiscoveryMapGeneration/);
  assert.doesNotMatch(discovery, /MAP_BLUR_UNMOUNT_DELAY_MS|setMapMounted|mapMounted/);
  assert.doesNotMatch(screen, /react-native-maps|<MapView|<Marker/);
  assert.doesNotMatch(screen, /<ContentImage|<ContentImageGallery/);
  assert.match(screen, /<InfoRow icon=\{MapPin\}/);
  assert.match(screen, /Build 36 P0/);
});

test('Event Details mounts native sheets only after the user requests them', async () => {
  const screen = await readFile(new URL('../screens/EventDetailsScreen.tsx', import.meta.url), 'utf8');
  assert.match(screen, /showCalendar \? \([\s\S]*<AddEventToCalendarSheet visible/);
  assert.match(screen, /showAttendees \? \([\s\S]*<EventAttendeesSheet visible/);
  assert.doesNotMatch(screen, /<AddEventToCalendarSheet visible=\{showCalendar\}/);
  assert.doesNotMatch(screen, /<EventAttendeesSheet visible=\{showAttendees\}/);
});
