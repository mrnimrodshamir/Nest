import test from 'node:test';
import assert from 'node:assert/strict';
import { selectWeekendDigestEvents } from './selectWeekendDigestEvents.ts';
import { weekendDigestPeriodFromStart } from './scheduleGate.ts';
import { TEL_AVIV_CENTER, type DigestCandidateOccurrence } from './selectDigestEvents.ts';

const PERIOD = weekendDigestPeriodFromStart('2026-08-27');

function event(id: string, startsAt: string, overrides: Partial<DigestCandidateOccurrence> = {}): DigestCandidateOccurrence {
  return {
    occurrenceId: id, eventId: `event-${id}`, title: `Family workshop ${id}`,
    description: 'A family activity for children and parents with guided creative play',
    category: 'workshop', startsAt, ageMinMonths: 24, ageMaxMonths: 96,
    priceNote: 'Free', provider: 'tel_aviv_digitel', sourceName: 'Official source',
    sourceUrl: `https://example.org/${id}`, sourceType: 'municipal', canonicalEventId: null,
    latitude: TEL_AVIV_CENTER.latitude, longitude: TEL_AVIV_CENTER.longitude,
    locationName: `Venue ${id}`, formattedAddress: 'Tel Aviv', ...overrides,
  };
}

test('Thursday evening begins at 17:00 Jerusalem and excludes 16:59', () => {
  const result = selectWeekendDigestEvents([
    event('early', '2026-08-27T16:59:00+03:00'),
    event('boundary', '2026-08-27T17:00:00+03:00'),
    event('late', '2026-08-27T23:59:00+03:00'),
  ], PERIOD);
  assert.deepEqual(result.sections[0].events.map((item) => item.occurrenceId).sort(), ['boundary', 'late']);
});

test('Friday and Saturday are separated and capped at three without filler', () => {
  const friday = Array.from({ length: 5 }, (_, index) => event(`fri-${index}`, `2026-08-28T${10 + index}:00:00+03:00`, { category: index % 2 ? 'story_time' : 'workshop' }));
  const saturday = [event('sat-one', '2026-08-29T10:00:00+03:00')];
  const result = selectWeekendDigestEvents([...friday, ...saturday], PERIOD);
  assert.equal(result.sections[1].events.length, 3);
  assert.equal(result.sections[2].events.length, 1, 'a weak day must underfill rather than invent filler');
  assert.equal(result.events.length, 4);
});

test('cross-provider mirrors are removed but distinct age sessions survive', () => {
  const common = {
    title: 'Harry Potter — Birth of a Leader',
    description: 'Family children parents guided activity and a detailed matching description',
    locationName: 'Museum Hall', formattedAddress: '1 Museum Street',
  };
  const result = selectWeekendDigestEvents([
    event('mirror-a', '2026-08-28T10:00:00+03:00', { ...common, provider: 'provider_a' }),
    event('mirror-b', '2026-08-28T10:05:00+03:00', { ...common, title: 'Harry Potter - Birth of a Leader', provider: 'provider_b' }),
    event('age-a', '2026-08-28T12:00:00+03:00', { title: 'Development class ages 18–30 months', ageMinMonths: 18, ageMaxMonths: 30 }),
    event('age-b', '2026-08-28T13:00:00+03:00', { title: 'Development class ages 30–42 months', ageMinMonths: 30, ageMaxMonths: 42 }),
  ], PERIOD);
  assert.equal(result.duplicatesRemoved, 1);
  assert.equal(result.events.filter((item) => item.occurrenceId.startsWith('age-')).length, 2);
});

test('cancelled and adult-only content are quality exclusions', () => {
  const result = selectWeekendDigestEvents([
    event('cancelled', '2026-08-28T10:00:00+03:00', { title: 'Cancelled family workshop', ageMinMonths: null, ageMaxMonths: null }),
    event('adult', '2026-08-28T11:00:00+03:00', { title: 'Late-night finance lecture', description: 'Professional lecture', ageMinMonths: null, ageMaxMonths: null, category: 'lecture' }),
    event('family', '2026-08-28T12:00:00+03:00'),
  ], PERIOD);
  assert.deepEqual(result.events.map((item) => item.occurrenceId), ['family']);
  assert.equal(result.qualityExclusions, 2);
});

test('eligible count excludes malformed or out-of-radius rows rejected by the shared selector', () => {
  const result = selectWeekendDigestEvents([
    event('valid', '2026-08-28T10:00:00+03:00'),
    event('invalid-coordinate', '2026-08-28T11:00:00+03:00', { latitude: null }),
    event('outside-tel-aviv', '2026-08-28T12:00:00+03:00', { latitude: 31.7683, longitude: 35.2137 }),
  ], PERIOD);
  assert.equal(result.eligibleCount, 1);
  assert.equal(result.qualityExclusions, 2);
});

test('optional RSVP counts do not affect the current deterministic ranking', () => {
  const candidates = [event('a', '2026-08-28T10:00:00+03:00'), event('b', '2026-08-28T11:00:00+03:00')];
  const base = selectWeekendDigestEvents(candidates, PERIOD);
  const futureSignal = selectWeekendDigestEvents(candidates, PERIOD, { rsvpCounts: { b: 999 } });
  assert.deepEqual(futureSignal.events.map((item) => item.occurrenceId), base.events.map((item) => item.occurrenceId));
});
