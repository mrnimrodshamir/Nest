/** Beit Ariela / Tel Aviv Libraries connector.
 *
 *  ariela.today has no API, RSS/ICS feed, or JSON-LD event markup — verified
 *  directly (fetched the live listing and a live event page, inspected the
 *  network log in a real browser for an underlying data endpoint, found
 *  none). What it does have: `robots.txt` explicitly allows crawling
 *  (`Allow: /`, only admin paths and `/past-events` disallowed) and ships a
 *  `sitemap.xml` — about as clear a legal signal as public-web scraping gets.
 *  This is tier 4/5 in the source-acquisition priority order: structured HTML
 *  extraction of a public municipal library calendar.
 *
 *  Regex-based, not a DOM library, on purpose: this file runs both inside a
 *  Deno Edge Function and inside plain Node for the dry-run script and tests,
 *  and the markup is a single, consistent CMS template (confirmed against
 *  real fetched pages, saved as fixtures) — exactly the case where a small
 *  set of anchored patterns is more auditable than a parser dependency two
 *  runtimes would need to agree on.
 *
 *  FAIL-CLOSED: `sourceComplete` goes false the moment anything looks off —
 *  a fetch error, a page missing its expected structural markers, pagination
 *  that cannot terminate cleanly, or a failure rate on individual records
 *  above a small tolerance. See fetchBeitArielaCandidates. */

const BASE_URL = 'https://ariela.today';
const LISTING_URL = `${BASE_URL}/events`;

export const MAX_LISTING_PAGES = 15;
/** Keep paging past the horizon so a same-day reordering on the source
 *  cannot make the fetch stop early and silently miss something. */
export const HORIZON_BUFFER_DAYS = 3;
/** Above this fraction of detail-page fetch failures, the run reports
 *  incomplete rather than silently shipping partial data as if it were
 *  whole. Some individual failures are tolerated — a single flaky request
 *  should not blank out an entire library system's calendar. */
export const DETAIL_FAILURE_TOLERANCE = 0.15;

export class BeitArielaConnectorError extends Error {
  readonly code: 'HTTP_ERROR' | 'STRUCTURAL_DRIFT' | 'PAGINATION_STALE';
  constructor(code: BeitArielaConnectorError['code'], message: string) {
    super(message);
    this.name = 'BeitArielaConnectorError';
    this.code = code;
  }
}

export interface BeitArielaListItem {
  slug: string;
  title: string | null;
  subhead: string | null;
  dateIso: string | null;
  dayName: string | null;
  time: string | null;
  place: string | null;
  imageUrl: string | null;
}

export interface BeitArielaDetail {
  slug: string;
  dayName: string | null;
  dateText: string | null;
  timesText: string | null;
  place: string | null;
  address: string | null;
  audienceText: string | null;
  priceText: string | null;
  registrationUrl: string | null;
  description: string | null;
  imageUrl: string | null;
  imageCredit: string | null;
}

export interface BeitArielaRawRecord {
  slug: string;
  title: string;
  subhead: string | null;
  place: string;
  address: string | null;
  audienceText: string | null;
  priceText: string | null;
  registrationUrl: string | null;
  description: string | null;
  imageUrl: string | null;
  imageCredit: string | null;
  startsAt: string;
  endsAt: string | null;
  sourceUrl: string;
}

export interface FetchBeitArielaOptions {
  fetchImpl?: typeof fetch;
  now?: Date;
  horizonDays?: number;
  maxPages?: number;
  /** Skips per-item detail fetches — used by tests that only need to prove
   *  listing pagination and parsing, so they do not depend on network access
   *  or a large fixture set. The dry-run script and the real sync always
   *  fetch details. */
  skipDetails?: boolean;
}

export interface BeitArielaFetchResult {
  records: BeitArielaRawRecord[];
  invalidListItems: { slug: string | null; reason: string }[];
  detailFetchFailures: { slug: string; reason: string }[];
  sourceComplete: boolean;
  incompleteReason: string | null;
  pagesFetched: number;
  rawListItemCount: number;
}

/* ---------------------------------------------------------------------- */
/* Listing page parsing                                                    */
/* ---------------------------------------------------------------------- */

const LIST_ITEM_MARKER = '<li class="events-list-item post"';
const LIST_CONTAINER_MARKER = 'class="events-list"';
const NEXT_PAGE_PATTERN = /<a class="next pagination__next"\s+href="([^"]+)"/;

/** True only when the page structurally looks like an events listing at
 *  all. A page that has drifted to a different template (redesign, error
 *  page served with HTTP 200, a maintenance placeholder) fails this even if
 *  it happens to return zero items — which is exactly the case a raw
 *  "0 items found" count cannot distinguish from "the calendar is genuinely
 *  empty this week." */
function looksStructurallyIntact(html: string): boolean {
  return html.includes(LIST_CONTAINER_MARKER);
}

export function parseListingPage(html: string): BeitArielaListItem[] {
  const items: BeitArielaListItem[] = [];
  let cursor = html.indexOf(LIST_ITEM_MARKER);
  while (cursor !== -1) {
    const next = html.indexOf(LIST_ITEM_MARKER, cursor + LIST_ITEM_MARKER.length);
    const closeUl = html.indexOf('</ul>', cursor);
    const end = next === -1 ? (closeUl === -1 ? html.length : closeUl) : Math.min(next, closeUl === -1 ? next : closeUl);
    const block = html.slice(cursor, end);
    const item = parseListItemBlock(block);
    if (item) items.push(item);
    cursor = next;
  }
  return items;
}

function parseListItemBlock(block: string): BeitArielaListItem | null {
  const slugMatch = block.match(/href="https:\/\/ariela\.today\/events\/([a-z0-9-]+)"\s+class="event-item-link"/);
  if (!slugMatch) return null;
  const slug = slugMatch[1];

  const year = block.match(/event-date-year">(\d{2})</)?.[1];
  const month = block.match(/event-date-month">(\d{2})</)?.[1];
  const day = block.match(/event-date-day">(\d{2})</)?.[1];
  const dateIso = year && month && day ? `20${year}-${month}-${day}` : null;

  return {
    slug,
    title: decodeHtml(block.match(/event-title">([\s\S]*?)<\/h2>/)?.[1] ?? null),
    subhead: decodeHtml(block.match(/event-subhead">([\s\S]*?)<\/p>/)?.[1] ?? null),
    dateIso,
    dayName: decodeHtml(block.match(/event-item-info-day">\s*([\s\S]*?)\s*<\/span>/)?.[1] ?? null),
    time: decodeHtml(block.match(/event-item-info-time">\s*([\s\S]*?)\s*<span class="sep"/)?.[1]?.trim() ?? null),
    place: decodeHtml(block.match(/event-item-info-place">([\s\S]*?)<\/span>/)?.[1] ?? null),
    imageUrl: block.match(/<img src="([^"]+)"/)?.[1] ?? null,
  };
}

export function findNextPageUrl(html: string): string | null {
  return html.match(NEXT_PAGE_PATTERN)?.[1] ?? null;
}

/* ---------------------------------------------------------------------- */
/* Detail page parsing                                                     */
/* ---------------------------------------------------------------------- */

export function parseDetailPage(html: string, slug: string): BeitArielaDetail | null {
  if (!html.includes('event-attributes')) return null;
  return {
    slug,
    dayName: decodeHtml(html.match(/event-attributes-day">\s*([\s\S]*?)\s*<span class="sep"/)?.[1] ?? null),
    dateText: html.match(/(\d{2}\/\d{2}\/\d{2})\s*<\/div>/)?.[1] ?? null,
    timesText: decodeHtml(html.match(/event-attributes-times">\s*([\s\S]*?)\s*<br/)?.[1] ?? null),
    place: decodeHtml(html.match(/event-attributes-place">\s*([\s\S]*?)<br/)?.[1] ?? null),
    address: decodeHtml(html.match(/event-attributes-place">[\s\S]*?<em>([\s\S]*?)<\/em>/)?.[1] ?? null),
    audienceText: decodeHtml(html.match(/event-attributes-audience">\s*<em>([\s\S]*?)<\/em>/)?.[1] ?? null),
    priceText: decodeHtml(html.match(/event-attributes-price">\s*([\s\S]*?)\s*<\/div>/)?.[1] ?? null),
    registrationUrl: html.match(/event-links">[\s\S]*?<a href="([^"]+)"/)?.[1] ?? null,
    description: decodeHtml(stripTags(html.match(/event-description[\s\S]*?text-block">([\s\S]*?)<\/div>/)?.[1] ?? '')) || null,
    imageUrl: html.match(/event-image">[\s\S]*?<img src="([^"]+)"/)?.[1] ?? null,
    imageCredit: decodeHtml(html.match(/figcaption\s*>\s*([\s\S]*?)\s*<\/figcaption>/)?.[1] ?? null),
  };
}

/* ---------------------------------------------------------------------- */
/* Orchestration                                                           */
/* ---------------------------------------------------------------------- */

export async function fetchBeitArielaCandidates(options: FetchBeitArielaOptions = {}): Promise<BeitArielaFetchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? new Date();
  const horizonDays = Math.max(1, options.horizonDays ?? 7);
  const maxPages = Math.max(1, options.maxPages ?? MAX_LISTING_PAGES);
  const horizonFloor = startOfDay(now).getTime();
  const horizonCeiling = horizonFloor + (horizonDays + HORIZON_BUFFER_DAYS) * 86_400_000;

  const listItems: BeitArielaListItem[] = [];
  let url: string | null = LISTING_URL;
  let pagesFetched = 0;

  while (url && pagesFetched < maxPages) {
    let response: Response;
    try {
      response = await fetchImpl(url, { headers: { Accept: 'text/html', 'Accept-Language': 'he' } });
    } catch (error) {
      return incomplete(listItems, pagesFetched, `network error fetching ${url}: ${(error as Error).message}`);
    }
    if (!response.ok) {
      return incomplete(listItems, pagesFetched, `HTTP ${response.status} fetching ${url}`);
    }
    const html = await response.text();
    if (!looksStructurallyIntact(html)) {
      return incomplete(listItems, pagesFetched, `page did not contain the expected events-list container: ${url}`);
    }

    const pageItems = parseListingPage(html);
    pagesFetched += 1;
    listItems.push(...pageItems);

    // A page inside the events container that yields zero parseable items is
    // drift (the template changed under us), not an empty week — an empty
    // week simply has no <li> markers to begin with, which parses to an
    // empty array without tripping this.
    if (pageItems.length === 0 && html.includes(LIST_ITEM_MARKER)) {
      return incomplete(listItems, pagesFetched, `page contained list markers but none parsed: ${url}`);
    }

    const pageDates = pageItems.map((item) => item.dateIso).filter((value): value is string => !!value);
    const allPastHorizon = pageDates.length > 0 && pageDates.every((iso) => Date.parse(iso) > horizonCeiling);

    const next = findNextPageUrl(html);
    if (allPastHorizon || !next) {
      url = null;
    } else {
      url = next;
    }
  }

  if (pagesFetched >= maxPages && url) {
    return incomplete(listItems, pagesFetched, `exceeded the ${maxPages}-page safety limit before reaching the horizon`);
  }

  const withinHorizon = listItems.filter((item) => {
    if (!item.dateIso) return false;
    const time = Date.parse(item.dateIso);
    return Number.isFinite(time) && time >= horizonFloor - 86_400_000 && time <= horizonFloor + horizonDays * 86_400_000;
  });

  const invalidListItems = listItems
    .filter((item) => !item.title || !item.dateIso)
    .map((item) => ({ slug: item.slug ?? null, reason: !item.title ? 'missing_title' : 'missing_or_unparseable_date' }));

  if (options.skipDetails) {
    return {
      records: [],
      invalidListItems,
      detailFetchFailures: [],
      sourceComplete: true,
      incompleteReason: null,
      pagesFetched,
      rawListItemCount: listItems.length,
    };
  }

  const records: BeitArielaRawRecord[] = [];
  const detailFetchFailures: { slug: string; reason: string }[] = [];
  const validItems = withinHorizon.filter((item) => item.title && item.dateIso);

  for (const item of validItems) {
    const detailUrl = `${BASE_URL}/events/${item.slug}`;
    try {
      const response = await fetchImpl(detailUrl, { headers: { Accept: 'text/html', 'Accept-Language': 'he' } });
      if (!response.ok) {
        detailFetchFailures.push({ slug: item.slug, reason: `HTTP ${response.status}` });
        continue;
      }
      const html = await response.text();
      const detail = parseDetailPage(html, item.slug);
      if (!detail) {
        detailFetchFailures.push({ slug: item.slug, reason: 'missing_event_attributes_block' });
        continue;
      }
      const record = mergeListAndDetail(item, detail);
      if (record) records.push(record);
      else detailFetchFailures.push({ slug: item.slug, reason: 'could_not_resolve_start_time' });
    } catch (error) {
      detailFetchFailures.push({ slug: item.slug, reason: (error as Error).message });
    }
  }

  const failureRate = validItems.length === 0 ? 0 : detailFetchFailures.length / validItems.length;
  if (failureRate > DETAIL_FAILURE_TOLERANCE) {
    return {
      records,
      invalidListItems,
      detailFetchFailures,
      sourceComplete: false,
      incompleteReason: `detail fetch failure rate ${(failureRate * 100).toFixed(0)}% exceeded the ${(DETAIL_FAILURE_TOLERANCE * 100).toFixed(0)}% tolerance`,
      pagesFetched,
      rawListItemCount: listItems.length,
    };
  }

  return {
    records,
    invalidListItems,
    detailFetchFailures,
    sourceComplete: true,
    incompleteReason: null,
    pagesFetched,
    rawListItemCount: listItems.length,
  };
}

function mergeListAndDetail(item: BeitArielaListItem, detail: BeitArielaDetail): BeitArielaRawRecord | null {
  const startsAt = resolveStartTime(item.dateIso, detail.timesText);
  if (!startsAt) return null;
  const endsAt = resolveEndTime(startsAt, detail.timesText);
  return {
    slug: item.slug,
    title: item.title ?? '',
    subhead: item.subhead,
    place: detail.place ?? item.place ?? '',
    address: detail.address,
    audienceText: detail.audienceText,
    priceText: detail.priceText,
    registrationUrl: detail.registrationUrl,
    description: detail.description,
    imageUrl: detail.imageUrl ?? item.imageUrl,
    imageCredit: detail.imageCredit,
    startsAt,
    endsAt,
    sourceUrl: `${BASE_URL}/events/${item.slug}`,
  };
}

/** "11:00—11:45" or "11:00" alone (em dash and hyphen both seen on real
 *  pages). Combined with the list item's own date, since the detail page's
 *  own date line is redundant with it and less consistently formatted. */
function resolveStartTime(dateIso: string | null, timesText: string | null): string | null {
  if (!dateIso) return null;
  const timeMatch = timesText?.match(/(\d{1,2}:\d{2})/);
  const time = timeMatch ? timeMatch[1] : '00:00';
  const iso = `${dateIso}T${time}:00+03:00`;
  return Number.isFinite(Date.parse(iso)) ? iso : null;
}

function resolveEndTime(startsAt: string, timesText: string | null): string | null {
  if (!timesText) return null;
  const match = timesText.match(/\d{1,2}:\d{2}\s*[—–-]\s*(\d{1,2}:\d{2})/);
  if (!match) return null;
  const datePart = startsAt.slice(0, 10);
  const iso = `${datePart}T${match[1]}:00+03:00`;
  return Number.isFinite(Date.parse(iso)) ? iso : null;
}

function incomplete(listItems: BeitArielaListItem[], pagesFetched: number, reason: string): BeitArielaFetchResult {
  return {
    records: [],
    invalidListItems: [],
    detailFetchFailures: [],
    sourceComplete: false,
    incompleteReason: reason,
    pagesFetched,
    rawListItemCount: listItems.length,
  };
}

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function stripTags(html: string): string {
  return html.replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]*>/g, ' ').replace(/[ \t]+/g, ' ');
}

function decodeHtml(value: string | null): string | null {
  if (!value) return null;
  const decoded = stripTags(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
  return decoded || null;
}
