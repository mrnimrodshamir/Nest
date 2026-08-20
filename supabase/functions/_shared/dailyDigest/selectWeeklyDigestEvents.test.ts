import test from 'node:test';
import assert from 'node:assert/strict';
import { buildWeeklySocialDigest, selectWeeklyDigestEvents } from './selectWeeklyDigestEvents.ts';
import type { DigestCandidateOccurrence } from './selectDigestEvents.ts';

const period = {
  weekStart: '2026-08-23',
  weekEnd: '2026-08-29',
  days: ['2026-08-23', '2026-08-24', '2026-08-25', '2026-08-26', '2026-08-27', '2026-08-28', '2026-08-29'],
};

function event(id: string, day: number, overrides: Partial<DigestCandidateOccurrence> = {}): DigestCandidateOccurrence {
  return {
    occurrenceId: id,
    eventId: `event-${id}`,
    title: `Event ${id}`,
    description: 'A detailed official family event description with useful information',
    category: 'community',
    startsAt: `2026-08-${String(day).padStart(2, '0')}T10:00:00+03:00`,
    ageMinMonths: null,
    ageMaxMonths: null,
    priceNote: null,
    provider: 'provider-a',
    providerEventId: `provider-${id}`,
    sourceName: 'Official source',
    sourceUrl: 'https://example.com/event',
    sourceType: 'municipal',
    canonicalEventId: null,
    latitude: 32.0853,
    longitude: 34.7818,
    locationName: 'Tel Aviv',
    formattedAddress: 'Tel Aviv',
    ...overrides,
  };
}

test('Weekly keeps zero/one/two days and caps 3+ days at three without filler', () => {
  const candidates = [
    event('one', 24),
    event('two-a', 25), event('two-b', 25),
    event('many-a', 26), event('many-b', 26), event('many-c', 26), event('many-d', 26),
  ];
  const selected = selectWeeklyDigestEvents(candidates, period);
  assert.deepEqual(selected.days.map((day) => day.events.length), [0, 1, 2, 3, 0, 0, 0]);
  assert.equal(selected.events.length, 6);
});

test('invalid, out-of-radius, canonical-secondary, and duplicate occurrences are excluded', () => {
  const selected = selectWeeklyDigestEvents([
    event('valid', 23),
    event('invalid-coordinate', 23, { latitude: 999 }),
    event('outside', 23, { latitude: 31.5, longitude: 34.0 }),
    event('canonical', 23, { canonicalEventId: 'event-valid' }),
    event('valid', 23),
  ], period);
  assert.deepEqual(selected.events.map((entry) => entry.occurrenceId), ['valid']);
});

test('Harry Potter punctuation mirrors across providers occupy one slot', () => {
  const shared = {
    description: 'הצגה משפחתית על הארי פוטר לידתו של מנהיג לכל המשפחה בתל אביב',
    latitude: 32.0853,
    longitude: 34.7818,
    locationName: 'היכל התרבות',
  };
  const selected = selectWeeklyDigestEvents([
    event('harry-a', 23, { ...shared, title: 'הארי פוטר — לידתו של מנהיג', provider: 'provider-a' }),
    event('harry-b', 23, { ...shared, title: 'הארי פוטר – לידתו של מנהיג', provider: 'provider-b' }),
  ], period);
  assert.equal(selected.events.length, 1);
});

test('separate age groups and separate times remain separate sessions', () => {
  const selected = selectWeeklyDigestEvents([
    event('age-a', 24, { title: 'התעמלות התפתחותית שנה וחצי-שנתיים וחצי', ageMinMonths: 18, ageMaxMonths: 30 }),
    event('age-b', 24, { title: 'התעמלות התפתחותית שנתים וחצי-שלוש וחצי', ageMinMonths: 30, ageMaxMonths: 42 }),
    event('time-a', 25, { title: 'שעת סיפור', startsAt: '2026-08-25T10:00:00+03:00' }),
    event('time-b', 25, { title: 'שעת סיפור', startsAt: '2026-08-25T17:00:00+03:00', occurrenceId: 'time-b' }),
  ], period);
  assert.equal(selected.events.filter((entry) => entry.occurrenceId.startsWith('age-')).length, 2);
  assert.equal(selected.events.filter((entry) => entry.occurrenceId.startsWith('time-')).length, 2);
});

test('week-wide selection prefers provider, category, and venue variety among valid peers', () => {
  const selected = selectWeeklyDigestEvents([
    event('a1', 23), event('a2', 23),
    event('b1', 23, { provider: 'provider-b', category: 'performance', locationName: 'Venue B' }),
    event('c1', 23, { provider: 'provider-c', category: 'cinema', locationName: 'Venue C' }),
  ], period).days[0].events;
  assert.equal(new Set(selected.map((entry) => entry.provider)).size, 3);
  assert.equal(new Set(selected.map((entry) => entry.category)).size, 3);
  assert.equal(new Set(selected.map((entry) => entry.locationName)).size, 3);
});

test('social representation contains public facts only', () => {
  const output = buildWeeklySocialDigest(selectWeeklyDigestEvents([event('one', 23)], period), 'tel_aviv');
  const serialized = JSON.stringify(output);
  assert.match(serialized, /sourceUrl/);
  assert.match(serialized, /ageMinMonths/);
  assert.doesNotMatch(serialized, /email|pushToken|child|birthdate|userId|private/i);
});
