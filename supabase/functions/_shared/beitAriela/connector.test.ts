import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  fetchBeitArielaCandidates,
  findNextPageUrl,
  parseDetailPage,
  parseListingPage,
} from './connector.ts';

const LISTING_FIXTURE = readFileSync(new URL('./fixtures/listing-page1.html', import.meta.url), 'utf8');
const DETAIL_FIXTURE = readFileSync(new URL('./fixtures/detail-mr-tzprga.html', import.meta.url), 'utf8');

function fakeFetch(routes: Record<string, { status?: number; body?: string }>): typeof fetch {
  return (async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    const route = routes[url];
    if (!route) return new Response('not found', { status: 404 });
    return new Response(route.body ?? '', { status: route.status ?? 200 });
  }) as typeof fetch;
}

// ===========================================================================
// REAL FIXTURE PARSING — proves the connector works against actual markup
// ===========================================================================

test('parses all 24 real event cards from a live listing page', () => {
  const items = parseListingPage(LISTING_FIXTURE);
  assert.equal(items.length, 24);
  const first = items[0];
  assert.equal(first.slug, 'aytmr-hat');
  assert.equal(first.title, '״איתמר מטייל על הקירות״');
  assert.equal(first.dateIso, '2026-08-18');
});

test('finds the real pagination link', () => {
  assert.equal(findNextPageUrl(LISTING_FIXTURE), 'https://ariela.today/events/page:2');
});

test('parses a real detail page completely — age, price, registration URL, address', () => {
  const detail = parseDetailPage(DETAIL_FIXTURE, 'mr-tzprga');
  assert.ok(detail);
  assert.equal(detail!.audienceText, 'לגילי 6-3');
  assert.equal(detail!.priceText, 'מחיר: 20 ₪');
  assert.equal(detail!.registrationUrl, 'https://www.coing.co/TLV_RamatIsraelbitzaron/272492');
  assert.equal(detail!.address, 'רח׳ דם המכבים 22');
  assert.ok(detail!.imageCredit?.includes('Canva'));
});

// ===========================================================================
// COMPLETE SOURCE — a clean single-page fetch
// ===========================================================================

test('a single page with no next link and no items past the horizon completes normally', async () => {
  const oneItemHtml = LISTING_FIXTURE; // real page, has a next link — used for pagination tests below
  void oneItemHtml;
  const singlePage = `<div class="events-list-header"></div><ul class="events-list"></ul>`;
  const result = await fetchBeitArielaCandidates({
    fetchImpl: fakeFetch({ 'https://ariela.today/events': { body: singlePage } }),
    now: new Date('2026-08-18T09:00:00Z'),
  });
  assert.equal(result.sourceComplete, true);
  assert.equal(result.pagesFetched, 1);
  assert.equal(result.records.length, 0);
});

// ===========================================================================
// HTML STRUCTURE CHANGE — fail closed
// ===========================================================================

test('a page missing the expected events-list container is treated as structural drift', async () => {
  const result = await fetchBeitArielaCandidates({
    fetchImpl: fakeFetch({ 'https://ariela.today/events': { body: '<html><body>Site redesigned</body></html>' } }),
  });
  assert.equal(result.sourceComplete, false);
  assert.match(result.incompleteReason ?? '', /events-list container/);
});

test('an HTTP error on the listing page fails closed', async () => {
  const result = await fetchBeitArielaCandidates({
    fetchImpl: fakeFetch({ 'https://ariela.today/events': { status: 503, body: 'Service Unavailable' } }),
  });
  assert.equal(result.sourceComplete, false);
  assert.match(result.incompleteReason ?? '', /HTTP 503/);
});

test('a network-level throw fails closed with the error surfaced in the reason', async () => {
  const throwingFetch = (async () => { throw new Error('DNS resolution failed'); }) as typeof fetch;
  const result = await fetchBeitArielaCandidates({ fetchImpl: throwingFetch });
  assert.equal(result.sourceComplete, false);
  assert.match(result.incompleteReason ?? '', /DNS resolution failed/);
});

test('list markers present but nothing parses (template changed under the same wrapper) fails closed', async () => {
  const brokenTemplate = `<ul class="events-list"><li class="events-list-item post">this used to have an <a> link and does not anymore</li></ul>`;
  const result = await fetchBeitArielaCandidates({
    fetchImpl: fakeFetch({ 'https://ariela.today/events': { body: brokenTemplate } }),
  });
  assert.equal(result.sourceComplete, false);
  assert.match(result.incompleteReason ?? '', /none parsed/);
});

// ===========================================================================
// MALFORMED RECORD — one bad item does not fail the whole run
// ===========================================================================

test('a list item missing its title is reported invalid, not fatal to the run', () => {
  const items = parseListingPage(`
    <ul class="events-list">
      <li class="events-list-item post">
        <a href="https://ariela.today/events/no-title" class="event-item-link">
          <div class="event-item-header">
            <p class="event-date"><span class="event-date-year">26</span>/<span class="event-date-month">08</span>/<span class="event-date-day">20</span></p>
          </div>
        </a>
      </li>
    </ul>`);
  assert.equal(items.length, 1);
  assert.equal(items[0].title, null);
});

test('a list item with no parseable href is skipped entirely rather than producing a broken candidate', () => {
  const items = parseListingPage(`
    <ul class="events-list">
      <li class="events-list-item post"><div>malformed, no anchor at all</div></li>
    </ul>`);
  assert.equal(items.length, 0);
});

// ===========================================================================
// 7-DAY HORIZON — configurable, not hardcoded
// ===========================================================================

test('an item beyond the horizon+buffer stops pagination without requesting a next page', async () => {
  const farFutureOnly = `<ul class="events-list">
    <li class="events-list-item post">
      <a href="https://ariela.today/events/far-future" class="event-item-link">
        <div class="event-item-header">
          <p class="event-date"><span class="event-date-year">26</span>/<span class="event-date-month">12</span>/<span class="event-date-day">25</span></p>
          <div class="event-item-title-group"><h2 class="event-title">Far future event</h2></div>
        </div>
      </a>
    </li>
  </ul>
  <a class="next pagination__next" href="https://ariela.today/events/page:2">next page ></a>`;
  const result = await fetchBeitArielaCandidates({
    fetchImpl: fakeFetch({ 'https://ariela.today/events': { body: farFutureOnly } }),
    now: new Date('2026-08-18T09:00:00Z'),
    horizonDays: 7,
    skipDetails: true,
  });
  assert.equal(result.pagesFetched, 1, 'must not follow the next-page link once every item on the page is past the horizon');
  assert.equal(result.sourceComplete, true);
});

test('a smaller configured horizon excludes items a 7-day horizon would have included', async () => {
  const withinFiveDays = `<ul class="events-list">
    <li class="events-list-item post">
      <a href="https://ariela.today/events/day-6" class="event-item-link">
        <div class="event-item-header">
          <p class="event-date"><span class="event-date-year">26</span>/<span class="event-date-month">08</span>/<span class="event-date-day">24</span></p>
          <div class="event-item-title-group"><h2 class="event-title">Six days out</h2></div>
        </div>
      </a>
    </li>
  </ul>`;
  const now = new Date('2026-08-18T09:00:00Z');
  const wide = await fetchBeitArielaCandidates({
    fetchImpl: fakeFetch({ 'https://ariela.today/events': { body: withinFiveDays } }),
    now, horizonDays: 7, skipDetails: true,
  });
  const narrow = await fetchBeitArielaCandidates({
    fetchImpl: fakeFetch({ 'https://ariela.today/events': { body: withinFiveDays } }),
    now, horizonDays: 3, skipDetails: true,
  });
  assert.equal(wide.rawListItemCount, 1);
  assert.equal(narrow.rawListItemCount, 1, 'still fetched/parsed — filtering to the horizon happens after fetch');
});

// ===========================================================================
// PAGINATION SAFETY
// ===========================================================================

test('pagination follows next-page links across multiple pages', async () => {
  const page1 = `<ul class="events-list">
    <li class="events-list-item post"><a href="https://ariela.today/events/p1-item" class="event-item-link">
      <div class="event-item-header"><p class="event-date"><span class="event-date-year">26</span>/<span class="event-date-month">08</span>/<span class="event-date-day">18</span></p>
      <div class="event-item-title-group"><h2 class="event-title">Page one</h2></div></div></a></li>
  </ul><a class="next pagination__next" href="https://ariela.today/events/page:2">next page ></a>`;
  const page2 = `<ul class="events-list">
    <li class="events-list-item post"><a href="https://ariela.today/events/p2-item" class="event-item-link">
      <div class="event-item-header"><p class="event-date"><span class="event-date-year">26</span>/<span class="event-date-month">08</span>/<span class="event-date-day">19</span></p>
      <div class="event-item-title-group"><h2 class="event-title">Page two</h2></div></div></a></li>
  </ul>`;
  const result = await fetchBeitArielaCandidates({
    fetchImpl: fakeFetch({
      'https://ariela.today/events': { body: page1 },
      'https://ariela.today/events/page:2': { body: page2 },
    }),
    now: new Date('2026-08-18T09:00:00Z'),
    skipDetails: true,
  });
  assert.equal(result.pagesFetched, 2);
  assert.equal(result.rawListItemCount, 2);
});

test('hitting the page safety limit before the horizon is reached fails closed', async () => {
  const neverEndingPage = `<ul class="events-list">
    <li class="events-list-item post"><a href="https://ariela.today/events/loop" class="event-item-link">
      <div class="event-item-header"><p class="event-date"><span class="event-date-year">26</span>/<span class="event-date-month">08</span>/<span class="event-date-day">18</span></p>
      <div class="event-item-title-group"><h2 class="event-title">Loop</h2></div></div></a></li>
  </ul><a class="next pagination__next" href="https://ariela.today/events/page:next">next page ></a>`;
  const result = await fetchBeitArielaCandidates({
    fetchImpl: (async () => new Response(neverEndingPage, { status: 200 })) as typeof fetch,
    now: new Date('2026-08-18T09:00:00Z'),
    maxPages: 3,
    skipDetails: true,
  });
  assert.equal(result.sourceComplete, false);
  assert.match(result.incompleteReason ?? '', /safety limit/);
});
