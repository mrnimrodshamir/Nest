import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  parseDayPage,
  isFamilyTagged,
  parseDurationMinutes,
  fetchCinemathequeCandidates,
} from './connector.ts';

const DAY1_FIXTURE = readFileSync(new URL('./fixtures/shown-2026-08-21.html', import.meta.url), 'utf8');
const DAY2_FIXTURE = readFileSync(new URL('./fixtures/shown-2026-08-22.html', import.meta.url), 'utf8');

function fakeFetch(routes: Record<string, { status?: number; body?: string }>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    const route = routes[url];
    if (!route) return new Response('not found', { status: 404 });
    return new Response(route.body ?? '', { status: route.status ?? 200 });
  }) as typeof fetch;
}

// ===========================================================================
// REAL FIXTURE PARSING
// ===========================================================================

test('parses all 13 real cards from a live day-schedule page', () => {
  const cards = parseDayPage(DAY1_FIXTURE);
  assert.equal(cards.length, 13);
});

test('filters to movie-cat-10 as the relevance authority — the site tags exactly 2 family cards on this day', () => {
  const cards = parseDayPage(DAY1_FIXTURE).filter(isFamilyTagged);
  assert.equal(cards.length, 2);
  assert.deepEqual(cards.map((c) => c.eventId).sort(), ['116049', '116167']);
});

test('parses duration, director, language, and showtimes off a real family card', () => {
  const cards = parseDayPage(DAY1_FIXTURE).filter(isFamilyTagged);
  const ladyAndTheTramp = cards.find((c) => c.eventId === '116049');
  assert.ok(ladyAndTheTramp);
  assert.equal(parseDurationMinutes(ladyAndTheTramp!.countryYearDuration), 78);
  assert.ok(ladyAndTheTramp!.director?.includes('ג\'רונימי'));
  assert.ok(ladyAndTheTramp!.language?.includes('מדובב'));
  assert.equal(ladyAndTheTramp!.showtimes.length, 1);
  assert.equal(ladyAndTheTramp!.showtimes[0].time, '13:30');
  assert.equal(ladyAndTheTramp!.showtimes[0].ticketId, '131769');
});

// ===========================================================================
// IDENTITY — same film, multiple dates, same event_id (the resolved question)
// ===========================================================================

test('the same film on two different day pages shares the identical event_id — the core identity finding', () => {
  const day1Family = parseDayPage(DAY1_FIXTURE).filter(isFamilyTagged);
  const day2Family = parseDayPage(DAY2_FIXTURE).filter(isFamilyTagged);
  const day1Ids = new Set(day1Family.map((c) => c.eventId));
  const day2Ids = new Set(day2Family.map((c) => c.eventId));
  const sharedIds = [...day1Ids].filter((id) => day2Ids.has(id));
  assert.ok(sharedIds.length >= 2, 'at least Lady & the Tramp and Coyote vs Acme should recur across both days');
  assert.ok(sharedIds.includes('116049'));
  assert.ok(sharedIds.includes('116167'));
});

test('different showtimes of the same film get different ticket ids — occurrence identity is per-showtime, not per-film', () => {
  const day1Family = parseDayPage(DAY1_FIXTURE).filter(isFamilyTagged);
  const day2Family = parseDayPage(DAY2_FIXTURE).filter(isFamilyTagged);
  const day1LadyTramp = day1Family.find((c) => c.eventId === '116049');
  const day2LadyTramp = day2Family.find((c) => c.eventId === '116049');
  assert.notEqual(day1LadyTramp!.showtimes[0].ticketId, day2LadyTramp!.showtimes[0].ticketId);
});

test('a real new title appearing only on day 2 (Toy Story 5) is its own distinct event_id', () => {
  const day2Family = parseDayPage(DAY2_FIXTURE).filter(isFamilyTagged);
  assert.equal(day2Family.length, 3);
  const toyStory = day2Family.find((c) => c.title?.includes('צעצוע של סיפור'));
  assert.ok(toyStory);
  assert.equal(toyStory!.eventId, '116050');
});

// ===========================================================================
// ORCHESTRATION — full multi-day fetch, occurrence assembly
// ===========================================================================

test('fetches two days and produces one occurrence per (event_id, showtime) — never collapsing distinct showtimes', async () => {
  const result = await fetchCinemathequeCandidates({
    fetchImpl: fakeFetch({
      'https://www.cinema.co.il/shown/?date=2026-08-21': { body: DAY1_FIXTURE },
      'https://www.cinema.co.il/shown/?date=2026-08-22': { body: DAY2_FIXTURE },
    }),
    now: new Date('2026-08-21T00:00:00Z'),
    horizonDays: 2,
  });
  assert.equal(result.sourceComplete, true);
  assert.equal(result.daysFetched, 2);
  // 116049 appears once per day (2), 116167 once per day (2), 116050 once on day 2 (1) = 5
  assert.equal(result.occurrences.length, 5);
  const eventIds = new Set(result.occurrences.map((o) => o.eventId));
  assert.equal(eventIds.size, 3, 'three distinct films (events), five occurrences total');
});

test('missing price is never fetched — no price field exists on the raw occurrence at all', async () => {
  const result = await fetchCinemathequeCandidates({
    fetchImpl: fakeFetch({ 'https://www.cinema.co.il/shown/?date=2026-08-21': { body: DAY1_FIXTURE } }),
    now: new Date('2026-08-21T00:00:00Z'),
    horizonDays: 1,
  });
  for (const occurrence of result.occurrences) {
    assert.equal('price' in occurrence, false);
    assert.equal('priceText' in occurrence, false);
  }
});

test('missing age: a card with no explicit age band has description text but no age field on the raw occurrence — mapping.ts decides null', async () => {
  const result = await fetchCinemathequeCandidates({
    fetchImpl: fakeFetch({ 'https://www.cinema.co.il/shown/?date=2026-08-21': { body: DAY1_FIXTURE } }),
    now: new Date('2026-08-21T00:00:00Z'),
    horizonDays: 1,
  });
  assert.ok(result.occurrences.length > 0);
  assert.equal('ageMinMonths' in result.occurrences[0], false);
});

// ===========================================================================
// SOURCE DISAPPEARANCE / INCOMPLETE FETCH — fail closed, one day matters
// ===========================================================================

test('any single day failing to fetch fails the whole run closed (7 requests total; one gap is a meaningful gap)', async () => {
  const result = await fetchCinemathequeCandidates({
    fetchImpl: fakeFetch({
      'https://www.cinema.co.il/shown/?date=2026-08-21': { body: DAY1_FIXTURE },
      // day 2 missing entirely — 404
    }),
    now: new Date('2026-08-21T00:00:00Z'),
    horizonDays: 2,
  });
  assert.equal(result.sourceComplete, false);
  assert.equal(result.dayFailures.length, 1);
});

test('a page missing the expected schedule container is structural drift', async () => {
  const result = await fetchCinemathequeCandidates({
    fetchImpl: fakeFetch({ 'https://www.cinema.co.il/shown/?date=2026-08-21': { body: '<html><body>redesigned</body></html>' } }),
    now: new Date('2026-08-21T00:00:00Z'),
    horizonDays: 1,
  });
  assert.equal(result.sourceComplete, false);
  assert.equal(result.dayFailures[0].reason, 'page did not contain the expected schedule container');
});
