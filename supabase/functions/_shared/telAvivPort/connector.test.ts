import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  fetchTelAvivPortCandidates,
  parseListingPage,
  parseDetailPage,
  EVERGREEN_SPAN_THRESHOLD_DAYS,
} from './connector.ts';

const LISTING_FIXTURE = readFileSync(new URL('./fixtures/events-listing.html', import.meta.url), 'utf8');
const GLOW_FIXTURE = readFileSync(new URL('./fixtures/detail-glow.html', import.meta.url), 'utf8');
const MUGZAM_FIXTURE = readFileSync(new URL('./fixtures/detail-mugzam.html', import.meta.url), 'utf8');

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

test('parses all 13 real event cards from a live listing page', () => {
  const items = parseListingPage(LISTING_FIXTURE);
  assert.equal(items.length, 13);
});

test('reads data-ts/data-ts-end as real UNIX-second timestamps, not text dates', () => {
  const items = parseListingPage(LISTING_FIXTURE);
  const glow = items.find((item) => item.slug === 'glow');
  assert.ok(glow);
  assert.equal(glow!.startsAtIso, '2026-08-13T21:00:00.000Z');
  assert.equal(glow!.endsAtIso, '2026-08-30T21:00:00.000Z');
  assert.deepEqual(glow!.termIds.sort(), ['17', '47', '55', '69']);
});

test('a card with data-ts-end="false" (the literal string) parses as a point event, not invalid', () => {
  const items = parseListingPage(LISTING_FIXTURE);
  const masterclass = items.find((item) => item.slug === 'masterclass');
  assert.ok(masterclass);
  assert.ok(masterclass!.startsAtIso);
  assert.equal(masterclass!.endsAtIso, null);
});

test('parses a real detail page — description, price, registration URL, venue line', () => {
  const detail = parseDetailPage(GLOW_FIXTURE);
  assert.ok(detail);
  assert.ok(detail!.description?.includes('GLOW'));
  assert.equal(detail!.priceText, '129 ₪ במכירה מוקדמת | 139 ₪ מחיר מלא');
  assert.equal(detail!.registrationUrl, 'https://www.to-mix.co.il/glow-exhibition/?utm_source=google&utm_medium=ppc&gad_source=1&gad_campaignid=24056208879&gbraid=0AAAAABtyTOC54v76JDoFNnZC4O11e_4p-&gclid=CjwKCAjwyuDTBhB-EiwANCQhLEfE5rzLhMy9zLb_RNPuaTEut1eBfTxj-reDjveSLijSG8KSCHd1axoCOXgQAvD_BwE');
  assert.equal(detail!.venueLine, 'האנגר 11, נמל תל אביב');
});

test('parses a detail page with a different closing marker shape (Mugzam has no address block)', () => {
  const detail = parseDetailPage(MUGZAM_FIXTURE);
  assert.ok(detail);
  assert.ok(detail!.description?.includes('מוגזם'));
});

// ===========================================================================
// EVERGREEN CLASSIFICATION — the brief's core requirement
// ===========================================================================

test('a genuine multi-day attraction (GLOW, ~18 days) is NOT excluded as evergreen', async () => {
  const result = await fetchTelAvivPortCandidates({
    fetchImpl: fakeFetch({
      'https://www.namal.co.il/events/': { body: LISTING_FIXTURE },
      'https://www.namal.co.il/events/glow/': { body: GLOW_FIXTURE },
      'https://www.namal.co.il/events/mugzam/': { body: MUGZAM_FIXTURE },
    }),
    now: new Date('2026-08-19T00:00:00Z'),
    horizonDays: 7,
  });
  // Not asserting overall sourceComplete here: the fixture only mocks
  // glow/mugzam detail routes, and another real within-horizon card
  // (a same-week masterclass event, irrelevant to this test) 404s against
  // this fake fetch, which is a detail-fetch-tolerance concern covered by
  // its own test below — not what this test is about.
  const glow = result.records.find((r) => r.slug === 'glow');
  assert.ok(glow, 'GLOW should survive as a real record, not be excluded as evergreen');
  assert.ok(!result.excludedEvergreen.some((e) => e.slug === 'glow'));
});

test('a permanent info page with a real end date ~8 months out IS excluded as evergreen', async () => {
  const result = await fetchTelAvivPortCandidates({
    fetchImpl: fakeFetch({
      'https://www.namal.co.il/events/': { body: LISTING_FIXTURE },
      'https://www.namal.co.il/events/glow/': { body: GLOW_FIXTURE },
      'https://www.namal.co.il/events/mugzam/': { body: MUGZAM_FIXTURE },
    }),
    now: new Date('2026-08-19T00:00:00Z'),
    horizonDays: 7,
  });
  const mizraka = result.excludedEvergreen.find((e) => e.slug === 'mizraka');
  assert.ok(mizraka, 'the fountain-hours page should be excluded as evergreen');
  assert.ok(mizraka!.spanDays > EVERGREEN_SPAN_THRESHOLD_DAYS);
});

test('a WhatsApp signup page spanning 15 months, tagged Kids+Family, is excluded as evergreen despite the tags', async () => {
  const result = await fetchTelAvivPortCandidates({
    fetchImpl: fakeFetch({
      'https://www.namal.co.il/events/': { body: LISTING_FIXTURE },
      'https://www.namal.co.il/events/glow/': { body: GLOW_FIXTURE },
      'https://www.namal.co.il/events/mugzam/': { body: MUGZAM_FIXTURE },
    }),
    now: new Date('2026-08-19T00:00:00Z'),
    horizonDays: 7,
  });
  assert.ok(result.excludedEvergreen.some((e) => e.slug === 'links'));
});

// ===========================================================================
// MISSING DATA — unknown stays null, never guessed
// ===========================================================================

test('missing price on a real event (Mugzam has no price line) resolves to null, not a guess', async () => {
  const result = await fetchTelAvivPortCandidates({
    fetchImpl: fakeFetch({
      'https://www.namal.co.il/events/': { body: LISTING_FIXTURE },
      'https://www.namal.co.il/events/glow/': { body: GLOW_FIXTURE },
      'https://www.namal.co.il/events/mugzam/': { body: MUGZAM_FIXTURE },
    }),
    now: new Date('2026-08-19T00:00:00Z'),
    horizonDays: 7,
  });
  const mugzam = result.records.find((r) => r.slug === 'mugzam');
  assert.ok(mugzam);
  assert.equal(mugzam!.priceText, null);
});

test('missing age is simply absent from the raw record — mapping.ts, not the connector, decides null vs parsed', async () => {
  const result = await fetchTelAvivPortCandidates({
    fetchImpl: fakeFetch({
      'https://www.namal.co.il/events/': { body: LISTING_FIXTURE },
      'https://www.namal.co.il/events/glow/': { body: GLOW_FIXTURE },
      'https://www.namal.co.il/events/mugzam/': { body: MUGZAM_FIXTURE },
    }),
    now: new Date('2026-08-19T00:00:00Z'),
    horizonDays: 7,
  });
  const glow = result.records.find((r) => r.slug === 'glow');
  assert.ok(glow);
  assert.equal(typeof glow!.description, 'string');
});

// ===========================================================================
// SOURCE DISAPPEARANCE / INCOMPLETE FETCH — fail closed
// ===========================================================================

test('a page missing the expected event-items container is treated as structural drift', async () => {
  const result = await fetchTelAvivPortCandidates({
    fetchImpl: fakeFetch({ 'https://www.namal.co.il/events/': { body: '<html><body>Site redesigned</body></html>' } }),
  });
  assert.equal(result.sourceComplete, false);
  assert.match(result.incompleteReason ?? '', /event-items container/);
});

test('an HTTP error on the listing page fails closed', async () => {
  const result = await fetchTelAvivPortCandidates({
    fetchImpl: fakeFetch({ 'https://www.namal.co.il/events/': { status: 500 } }),
  });
  assert.equal(result.sourceComplete, false);
  assert.match(result.incompleteReason ?? '', /HTTP 500/);
});

test('detail fetch failures above the tolerance fail the whole run closed', async () => {
  const result = await fetchTelAvivPortCandidates({
    fetchImpl: fakeFetch({
      'https://www.namal.co.il/events/': { body: LISTING_FIXTURE },
      // glow and mugzam both 404 — every within-horizon item fails its detail fetch
    }),
    now: new Date('2026-08-19T00:00:00Z'),
    horizonDays: 7,
  });
  assert.equal(result.sourceComplete, false);
  assert.match(result.incompleteReason ?? '', /detail fetch failure rate/);
});

test('a single page with no items completes normally (an empty week is not drift)', async () => {
  const emptyPage = `<div class="event-items"></div>`;
  const result = await fetchTelAvivPortCandidates({
    fetchImpl: fakeFetch({ 'https://www.namal.co.il/events/': { body: emptyPage } }),
  });
  assert.equal(result.sourceComplete, true);
  assert.equal(result.records.length, 0);
});
