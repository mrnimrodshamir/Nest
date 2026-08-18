import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapCinemathequeOccurrence } from './mapping.ts';
import type { CinemathequeRawOccurrence } from './connector.ts';

function raw(overrides: Partial<CinemathequeRawOccurrence> = {}): CinemathequeRawOccurrence {
  return {
    eventId: '116049',
    ticketId: '131769',
    title: 'היפהפייה והיחפן - מדובב | הקרנה על פופים',
    sourceUrl: 'https://www.cinema.co.il/event/lady-and-the-tramp/',
    durationMinutes: 78,
    director: 'קלייד ג\'רונימי',
    language: 'מדובב לעברית, ללא תרגום',
    country: 'ארה"ב',
    year: '1955',
    description: 'קלאסיקה לילדים ולהוריהם.',
    hall: null,
    startsAt: '2026-08-21T13:30:00+03:00',
    ...overrides,
  };
}

// ===========================================================================
// IDENTITY — providerEventId keyed by event_id, occurrenceFingerprint by time
// ===========================================================================

test('two occurrences with the SAME event_id but different times share providerEventId, differ in occurrenceFingerprint', () => {
  const first = mapCinemathequeOccurrence(raw({ startsAt: '2026-08-21T13:30:00+03:00', ticketId: '131769' }));
  const second = mapCinemathequeOccurrence(raw({ startsAt: '2026-08-22T11:00:00+03:00', ticketId: '131770' }));
  assert.equal(first.candidate!.providerEventId, second.candidate!.providerEventId);
  assert.notEqual(first.candidate!.occurrenceFingerprint, second.candidate!.occurrenceFingerprint);
  assert.notEqual(first.candidate!.providerTransportId, second.candidate!.providerTransportId);
});

test('two DIFFERENT event_ids never collapse to the same providerEventId, even with similar titles', () => {
  const a = mapCinemathequeOccurrence(raw({ eventId: '116049', title: 'לוני טונס מציגים: קיוטי נגד אקמי - מדובב' }));
  const b = mapCinemathequeOccurrence(raw({ eventId: '116167', title: 'לוני טונס מציגים: קיוטי נגד אקמי - מתורגם' }));
  assert.notEqual(a.candidate!.providerEventId, b.candidate!.providerEventId);
});

test('sourceGroupId carries the raw event_id for downstream grouping/reporting', () => {
  const result = mapCinemathequeOccurrence(raw());
  assert.equal(result.candidate!.sourceGroupId, '116049');
});

// ===========================================================================
// PRICE — never crawled, always null, by design
// ===========================================================================

test('priceNote is always null — this connector never fetches the ticket checkout flow', () => {
  const result = mapCinemathequeOccurrence(raw());
  assert.equal(result.candidate!.priceNote, null);
});

// ===========================================================================
// AGE — only from explicit text, "for all ages" phrasing does not count
// ===========================================================================

test('a description with an explicit age band parses it', () => {
  const result = mapCinemathequeOccurrence(raw({ description: 'סדנה לגילאי 7-3 בקיץ' }));
  assert.equal(result.candidate!.ageMinMonths, 36);
  assert.equal(result.candidate!.ageMaxMonths, 84);
});

test('vague "לכל הגילאים" (all ages) phrasing correctly resolves to unknown, not a guessed range', () => {
  const result = mapCinemathequeOccurrence(raw({ description: 'הצגה מצחיקה ומרגשת המתאימה באמת לכל הגילאים.' }));
  assert.equal(result.candidate!.ageMinMonths, null);
  assert.equal(result.candidate!.ageMaxMonths, null);
});

// ===========================================================================
// HALL — occurrence metadata, never a second venue/coordinate
// ===========================================================================

test('hall (when present) lands in providerMetadata, never as a second location', () => {
  const result = mapCinemathequeOccurrence(raw({ hall: '6' }));
  assert.equal(result.candidate!.providerMetadata.hall, '6');
  assert.equal(result.candidate!.locationName, 'סינמטק תל אביב');
});

test('missing hall (the common real case) stays null, not fabricated', () => {
  const result = mapCinemathequeOccurrence(raw({ hall: null }));
  assert.equal(result.candidate!.providerMetadata.hall, null);
});

// ===========================================================================
// VENUE — one canonical building, every screening is indoors by definition
// ===========================================================================

test('every occurrence resolves to the one canonical Cinematheque venue', () => {
  const result = mapCinemathequeOccurrence(raw());
  assert.equal(result.candidate!.latitude, 32.070663);
  assert.equal(result.candidate!.longitude, 34.78335);
  assert.equal(result.candidate!.indoorOutdoor, 'indoor');
  assert.equal(result.candidate!.sourceType, 'external_organizer');
});

// ===========================================================================
// DURATION → endTime derivation
// ===========================================================================

test('a known duration derives endTime as startTime + duration minutes', () => {
  const result = mapCinemathequeOccurrence(raw({ startsAt: '2026-08-21T13:30:00+03:00', durationMinutes: 78 }));
  assert.equal(result.candidate!.endTime, new Date(Date.parse('2026-08-21T13:30:00+03:00') + 78 * 60_000).toISOString());
});

test('an unknown duration leaves endTime null rather than a guessed value', () => {
  const result = mapCinemathequeOccurrence(raw({ durationMinutes: null }));
  assert.equal(result.candidate!.endTime, null);
});

test('missing title is excluded', () => {
  const result = mapCinemathequeOccurrence(raw({ title: '' }));
  assert.equal(result.excludedReason, 'missing_title');
});
