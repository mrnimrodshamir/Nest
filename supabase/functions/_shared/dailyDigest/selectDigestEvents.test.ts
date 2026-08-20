import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  selectDigestEvents,
  TEL_AVIV_CENTER,
  DEFAULT_DIGEST_RADIUS_KM,
  DEFAULT_DIGEST_MAX_RESULTS,
  DEFAULT_DIGEST_MIN_RESULTS,
  type DigestCandidateOccurrence,
} from './selectDigestEvents.ts';

const TODAY = '2026-08-20';

function baseOptions(overrides: Partial<Parameters<typeof selectDigestEvents>[1]> = {}) {
  return {
    localDate: TODAY,
    targetLatitude: TEL_AVIV_CENTER.latitude,
    targetLongitude: TEL_AVIV_CENTER.longitude,
    maxRadiusKm: DEFAULT_DIGEST_RADIUS_KM,
    minResults: DEFAULT_DIGEST_MIN_RESULTS,
    maxResults: DEFAULT_DIGEST_MAX_RESULTS,
    ...overrides,
  };
}

function occurrence(overrides: Partial<DigestCandidateOccurrence>): DigestCandidateOccurrence {
  return {
    occurrenceId: overrides.occurrenceId ?? `occ-${Math.random()}`,
    eventId: overrides.eventId ?? `event-${Math.random()}`,
    title: 'Story time at the library',
    category: 'story_time',
    startsAt: `${TODAY}T10:00:00+03:00`,
    ageMinMonths: 24,
    ageMaxMonths: 60,
    priceNote: 'Free',
    provider: 'tel_aviv_digitel',
    sourceName: 'Tel Aviv Municipality',
    sourceType: 'municipal',
    canonicalEventId: null,
    latitude: TEL_AVIV_CENTER.latitude,
    longitude: TEL_AVIV_CENTER.longitude,
    locationName: 'Beit Ariela',
    ...overrides,
  };
}

test('0 valid candidates selects nothing — never fabricates filler', () => {
  assert.deepEqual(selectDigestEvents([], baseOptions()), []);
});

test('2 valid candidates selects exactly 2, not padded to a target count', () => {
  const result = selectDigestEvents([
    occurrence({ occurrenceId: 'a' }),
    occurrence({ occurrenceId: 'b', category: 'workshop' }),
  ], baseOptions());
  assert.equal(result.length, 2);
});

test('more than 5 valid candidates caps at DEFAULT_DIGEST_MAX_RESULTS', () => {
  const candidates = Array.from({ length: 9 }, (_, i) =>
    occurrence({ occurrenceId: `occ-${i}`, category: `cat-${i}`, priceNote: i % 2 === 0 ? 'Free' : null }));
  const result = selectDigestEvents(candidates, baseOptions());
  assert.equal(result.length, DEFAULT_DIGEST_MAX_RESULTS);
});

test('an occurrence outside Jerusalem-local "today" is excluded even if the ISO date string looks like today', () => {
  // 2026-08-20T23:30:00Z is already 2026-08-21 02:30 in Jerusalem (IDT).
  const result = selectDigestEvents([occurrence({ startsAt: '2026-08-20T23:30:00Z' })], baseOptions());
  assert.equal(result.length, 0);
});

test('an occurrence just after Jerusalem midnight still belongs to today', () => {
  // 2026-08-19T21:30:00Z == 2026-08-20T00:30 Jerusalem (IDT).
  const result = selectDigestEvents([occurrence({ startsAt: '2026-08-19T21:30:00Z' })], baseOptions());
  assert.equal(result.length, 1);
});

test('a canonical-secondary duplicate is excluded', () => {
  const result = selectDigestEvents([
    occurrence({ occurrenceId: 'dup', canonicalEventId: 'event-primary' }),
  ], baseOptions());
  assert.equal(result.length, 0);
});

test('an occurrence with no lat/long is excluded (invalid location)', () => {
  const result = selectDigestEvents([occurrence({ latitude: null, longitude: null })], baseOptions());
  assert.equal(result.length, 0);
});

test('malformed dates, coordinates, titles, and duplicate occurrence rows are excluded safely', () => {
  const duplicate = occurrence({ occurrenceId: 'same', category: 'workshop' });
  const result = selectDigestEvents([
    occurrence({ occurrenceId: 'bad-date', startsAt: 'not-a-date' }),
    occurrence({ occurrenceId: 'bad-latitude', latitude: 200 }),
    occurrence({ occurrenceId: 'missing-title', title: '   ' }),
    duplicate,
    { ...duplicate, title: 'Duplicate join row' },
  ], baseOptions());
  assert.deepEqual(result.map((event) => event.occurrenceId), ['same']);
});

test('an occurrence far outside the Tel Aviv radius is excluded', () => {
  // Jerusalem city center — real coordinates, ~55km from Tel Aviv, outside
  // the default 12km digest radius.
  const result = selectDigestEvents([occurrence({ latitude: 31.7683, longitude: 35.2137 })], baseOptions());
  assert.equal(result.length, 0);
});

test('provider attribution survives selection unchanged', () => {
  const result = selectDigestEvents([
    occurrence({ occurrenceId: 'a', provider: 'tel_aviv_digitel', sourceType: 'municipal' }),
    occurrence({ occurrenceId: 'b', category: 'workshop', provider: 'cinematheque_tel_aviv', sourceType: 'external_organizer' }),
  ], baseOptions());
  const providers = result.map((e) => e.provider).sort();
  assert.deepEqual(providers, ['cinematheque_tel_aviv', 'tel_aviv_digitel']);
});

test('ranking prefers events with age data, price info, and municipal trust', () => {
  const rich = occurrence({ occurrenceId: 'rich', category: 'a', ageMinMonths: 12, priceNote: 'Free', sourceType: 'municipal' });
  const bare = occurrence({ occurrenceId: 'bare', category: 'b', ageMinMonths: null, ageMaxMonths: null, priceNote: null, sourceType: 'external_organizer' });
  const result = selectDigestEvents([bare, rich], baseOptions());
  assert.equal(result[0].occurrenceId, 'rich');
});

test('diversity: no more than 2 of the same category when better alternatives exist', () => {
  const candidates = [
    ...Array.from({ length: 4 }, (_, i) => occurrence({ occurrenceId: `story-${i}`, category: 'story_time' })),
    occurrence({ occurrenceId: 'workshop-1', category: 'workshop' }),
  ];
  const result = selectDigestEvents(candidates, baseOptions({ maxResults: 3 }));
  const storyTimeCount = result.filter((e) => e.category === 'story_time').length;
  assert.ok(storyTimeCount <= 2, `expected at most 2 story_time events, got ${storyTimeCount}`);
  assert.ok(result.some((e) => e.category === 'workshop'), 'diverse category was not included');
});

test('diversity cap does not leave slots empty when there are not enough distinct categories', () => {
  // Only one category exists at all — the cap must not shrink the result
  // below what's actually available.
  const candidates = Array.from({ length: 5 }, (_, i) => occurrence({ occurrenceId: `story-${i}`, category: 'story_time' }));
  const result = selectDigestEvents(candidates, baseOptions());
  assert.equal(result.length, 5);
});

test('selection is deterministic — same input produces the same order every time', () => {
  const candidates = Array.from({ length: 6 }, (_, i) => occurrence({ occurrenceId: `occ-${i}`, category: `cat-${i % 3}` }));
  const first = selectDigestEvents(candidates, baseOptions()).map((e) => e.occurrenceId);
  const second = selectDigestEvents(candidates, baseOptions()).map((e) => e.occurrenceId);
  assert.deepEqual(first, second);
});
