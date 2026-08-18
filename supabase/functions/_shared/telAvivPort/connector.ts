/** Tel Aviv Port (Namal Tel Aviv) connector.
 *
 *  namal.co.il has no API, RSS/ICS, or JSON-LD event markup — verified by
 *  fetching the live /events/ listing directly and inspecting it (no
 *  network log tooling available in this runtime, so this is a weaker
 *  verification than Beit Ariela's live-browser check, but no structured
 *  data of any kind is present in the fetched HTML). What the page DOES
 *  have, and what this connector relies on: every `.event-item` card
 *  carries `data-ts` / `data-ts-end` UNIX-SECOND attributes for its
 *  start/end — machine-readable, not a text date to parse — and a
 *  `data-filter-by="N"` taxonomy whose Hebrew labels are printed by the
 *  page's own filter buttons. Confirmed live on 2026-08-19:
 *    47 = "ילדים" (Kids), 69 = "משפחה" (Family).
 *  Those two term ids are the site's own family signal for this
 *  connector — the same role Cinematheque's `movie-cat-10` plays there —
 *  used as the relevance authority, not inferred from title keywords.
 *
 *  THE EVERGREEN PROBLEM (why EVERGREEN_SPAN_THRESHOLD_DAYS exists):
 *  the /events/ listing mixes genuinely time-boxed attractions with
 *  permanent info/marketing pages that happen to carry a real future end
 *  date. Observed live, in the SAME listing, on the SAME day:
 *    - "GLOW" light exhibition: 2026-07-24 to 2026-08-31 (~5.5 weeks)
 *    - "Mugzam" summer festival: 2026-08-12 to 2026-08-31 (~2.5 weeks)
 *    - fountain operating-hours page: 2026-05-03 to 2026-12-30 (~8 months),
 *      carrying the Family(69) tag
 *    - a WhatsApp-group signup page: 2026-01-28 to 2027-04-29 (~15 months),
 *      carrying BOTH Kids(47) and Family(69) tags
 *  A discrete or multi-day *event* has a bounded run; a marketing page
 *  does not, even when the site tags it the same way. 45 days is chosen
 *  because it sits comfortably between the longest real attraction seen
 *  (~5.5 weeks) and the shortest evergreen page seen (~8 months) — not
 *  tuned to fit one example, and re-checkable against future runs.
 *
 *  Regex-based over the fetched HTML, not a DOM library — same reasoning
 *  as beitAriela/connector.ts: this runs in both Deno and plain Node, and
 *  the markup is a single consistent template.
 *
 *  FAIL-CLOSED: sourceComplete is false the moment the page does not look
 *  structurally like the events listing at all, or too many detail-page
 *  fetches fail. No pagination exists on this listing (confirmed live —
 *  no `page-numbers`/`next`/`load-more` markers on a full fetch of
 *  /events/, and only 9 items total), so completeness only depends on the
 *  single listing fetch and the detail-page fetches succeeding. */

const BASE_URL = 'https://www.namal.co.il';
const LISTING_URL = `${BASE_URL}/events/`;

export const DETAIL_FAILURE_TOLERANCE = 0.15;
/** See the module doc above — grounded in real observed spans, not guessed. */
export const EVERGREEN_SPAN_THRESHOLD_DAYS = 45;
/** Confirmed live on 2026-08-19 via the listing page's own filter-button
 *  labels (`data-filter-by="N"` → printed Hebrew text). Not guessed. */
export const KIDS_TERM_ID = '47';
export const FAMILY_TERM_ID = '69';

export class TelAvivPortConnectorError extends Error {
  readonly code: 'HTTP_ERROR' | 'STRUCTURAL_DRIFT';
  constructor(code: TelAvivPortConnectorError['code'], message: string) {
    super(message);
    this.name = 'TelAvivPortConnectorError';
    this.code = code;
  }
}

export interface TelAvivPortListItem {
  slug: string;
  title: string | null;
  startsAtIso: string | null;
  endsAtIso: string | null;
  termIds: string[];
  sourceUrl: string;
}

export interface TelAvivPortDetail {
  slug: string;
  description: string | null;
  priceText: string | null;
  registrationUrl: string | null;
  venueLine: string | null;
}

export interface TelAvivPortRawRecord {
  slug: string;
  title: string;
  termIds: string[];
  description: string | null;
  priceText: string | null;
  registrationUrl: string | null;
  venueLine: string | null;
  startsAt: string;
  endsAt: string | null;
  sourceUrl: string;
}

export interface FetchTelAvivPortOptions {
  fetchImpl?: typeof fetch;
  now?: Date;
  horizonDays?: number;
  /** Skips per-item detail fetches — tests only, same as Beit Ariela. */
  skipDetails?: boolean;
}

export interface TelAvivPortFetchResult {
  records: TelAvivPortRawRecord[];
  invalidListItems: { slug: string | null; reason: string }[];
  excludedEvergreen: { slug: string; title: string | null; spanDays: number }[];
  detailFetchFailures: { slug: string; reason: string }[];
  sourceComplete: boolean;
  incompleteReason: string | null;
  rawListItemCount: number;
}

/* ---------------------------------------------------------------------- */
/* Listing page parsing                                                    */
/* ---------------------------------------------------------------------- */

const ITEM_MARKER = 'class="event-item inner-filter ';
const LISTING_CONTAINER_MARKER = 'class="event-items"';

function looksStructurallyIntact(html: string): boolean {
  return html.includes(LISTING_CONTAINER_MARKER);
}

export function parseListingPage(html: string): TelAvivPortListItem[] {
  const items: TelAvivPortListItem[] = [];
  let cursor = html.indexOf(ITEM_MARKER);
  while (cursor !== -1) {
    const next = html.indexOf(ITEM_MARKER, cursor + ITEM_MARKER.length);
    const end = next === -1 ? html.length : next;
    const block = html.slice(cursor, end);
    const item = parseItemBlock(block);
    if (item) items.push(item);
    cursor = next;
  }
  return items;
}

function parseItemBlock(block: string): TelAvivPortListItem | null {
  const classMatch = block.match(/^class="event-item inner-filter ([^"]*)"/);
  const tsMatch = block.match(/data-ts="(\d+)"/);
  const tsEndMatch = block.match(/data-ts-end="(\d+)"/);
  const hrefMatch = block.match(/href="(https:\/\/www\.namal\.co\.il\/events\/([a-z0-9-]+)\/)"/);
  if (!hrefMatch) return null;
  const termIds = (classMatch?.[1] ?? '')
    .split(/\s+/)
    .map((token) => token.match(/^term-id-(\d+)$/)?.[1])
    .filter((value): value is string => !!value);

  return {
    slug: hrefMatch[2],
    title: decodeHtml(block.match(/event-title">\s*<a[^>]*>([\s\S]*?)<\/a>/)?.[1] ?? null),
    startsAtIso: tsMatch ? new Date(Number(tsMatch[1]) * 1000).toISOString() : null,
    endsAtIso: tsEndMatch ? new Date(Number(tsEndMatch[1]) * 1000).toISOString() : null,
    termIds,
    sourceUrl: hrefMatch[1],
  };
}

/* ---------------------------------------------------------------------- */
/* Detail page parsing                                                     */
/* ---------------------------------------------------------------------- */

/** The detail page's real content lives inside a `content-text` block that
 *  also appears as the listing page's popup-modal body — confirmed by
 *  fetching a standalone /events/<slug>/ URL directly and finding the same
 *  markup, so a plain per-slug fetch (no modal/JS needed) works. */
const CONTENT_START_MARKER = 'class="content-text">';
/** Real fetched detail pages are not consistent about what immediately
 *  follows the content block (confirmed live: one page is closed by an
 *  address block a few hundred characters later, another has no address
 *  block at all and runs for tens of thousands of characters before the
 *  next of these markers appears) — so this takes the EARLIEST of several
 *  known later-page markers rather than assuming one fixed shape, with a
 *  hard length cap as a last-resort backstop against swallowing the rest
 *  of the document. */
const CONTENT_END_MARKERS = ['<div class="modal-body-address"', '<div class="more-details"', '<div class="modal-footer', 'class="share-to"'];
const CONTENT_MAX_LENGTH = 8_000;

export function parseDetailPage(html: string): TelAvivPortDetail | null {
  const startIndex = html.indexOf(CONTENT_START_MARKER);
  if (startIndex === -1) return null;
  const contentStart = startIndex + CONTENT_START_MARKER.length;

  let contentEnd = Math.min(html.length, contentStart + CONTENT_MAX_LENGTH);
  for (const marker of CONTENT_END_MARKERS) {
    const markerIndex = html.indexOf(marker, contentStart);
    if (markerIndex !== -1) contentEnd = Math.min(contentEnd, markerIndex);
  }

  const contentHtml = trimToLastCompleteTag(html.slice(contentStart, contentEnd));
  const description = decodeHtml(stripTags(contentHtml)) || null;

  const priceMatch = contentHtml.match(/מחיר:<\/strong>\s*([^<]*)/);
  const registrationMatch = contentHtml.match(/<a href="(https:\/\/www\.to-mix\.co\.il[^"]*|https:\/\/[^"]*tickets?[^"]*)"[^>]*>[^<]*(?:רכישת כרטיסים|לרכישת כרטיסים)/i);
  const venueMatch = contentHtml.match(/📍\s*([^<\n]+)/);

  return {
    slug: '',
    description,
    priceText: priceMatch ? priceMatch[1].replace(/\|\s*$/, '').trim() || null : null,
    registrationUrl: registrationMatch ? decodeHtmlEntitiesInUrl(registrationMatch[1]) : null,
    venueLine: venueMatch ? venueMatch[1].trim() : null,
  };
}

/* ---------------------------------------------------------------------- */
/* Orchestration                                                           */
/* ---------------------------------------------------------------------- */

export async function fetchTelAvivPortCandidates(options: FetchTelAvivPortOptions = {}): Promise<TelAvivPortFetchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? new Date();
  const horizonDays = Math.max(1, options.horizonDays ?? 7);
  const horizonFloor = now.getTime();
  const horizonCeiling = horizonFloor + horizonDays * 86_400_000;

  let response: Response;
  try {
    response = await fetchImpl(LISTING_URL, { headers: { Accept: 'text/html', 'Accept-Language': 'he' } });
  } catch (error) {
    return incomplete(0, `network error fetching ${LISTING_URL}: ${(error as Error).message}`);
  }
  if (!response.ok) return incomplete(0, `HTTP ${response.status} fetching ${LISTING_URL}`);
  const html = await response.text();
  if (!looksStructurallyIntact(html)) {
    return incomplete(0, `page did not contain the expected event-items container: ${LISTING_URL}`);
  }

  const listItems = parseListingPage(html);
  if (listItems.length === 0 && html.includes(ITEM_MARKER)) {
    return incomplete(0, 'page contained event-item markers but none parsed');
  }

  const invalidListItems = listItems
    .filter((item) => !item.title || !item.startsAtIso)
    .map((item) => ({ slug: item.slug ?? null, reason: !item.title ? 'missing_title' : 'missing_or_unparseable_start_timestamp' }));

  // endsAtIso is legitimately absent for a genuinely single-point event —
  // confirmed live: `data-ts-end="false"` (the literal string, not a
  // number) on real single-date cards ("15.9 ב17:00", a specific
  // Wednesday masterclass), each with exactly one <time> element on the
  // page, not a range. Requiring an end timestamp would wrongly drop every
  // true discrete event, so only startsAtIso is required here.
  const withStart = listItems.filter(
    (item): item is TelAvivPortListItem & { title: string; startsAtIso: string } => !!item.title && !!item.startsAtIso,
  );

  const excludedEvergreen: { slug: string; title: string | null; spanDays: number }[] = [];
  const withinHorizon = withStart.filter((item) => {
    const start = Date.parse(item.startsAtIso);
    const end = item.endsAtIso ? Date.parse(item.endsAtIso) : start;
    const spanDays = (end - start) / 86_400_000;
    if (spanDays > EVERGREEN_SPAN_THRESHOLD_DAYS) {
      excludedEvergreen.push({ slug: item.slug, title: item.title, spanDays: Math.round(spanDays) });
      return false;
    }
    // Overlaps the horizon window at all (an in-progress multi-day run
    // that started before "now" still counts, same as Beit Ariela's
    // one-day-back buffer). A point event with no end uses its own start
    // as the effective end, so a stale past-dated card (observed live:
    // a marketing card still start-dated over a year in the past) is
    // correctly excluded rather than treated as still valid.
    return end >= horizonFloor - 86_400_000 && start <= horizonCeiling;
  });

  if (options.skipDetails) {
    return {
      records: [],
      invalidListItems,
      excludedEvergreen,
      detailFetchFailures: [],
      sourceComplete: true,
      incompleteReason: null,
      rawListItemCount: listItems.length,
    };
  }

  const records: TelAvivPortRawRecord[] = [];
  const detailFetchFailures: { slug: string; reason: string }[] = [];

  for (const item of withinHorizon) {
    try {
      const detailResponse = await fetchImpl(item.sourceUrl, { headers: { Accept: 'text/html', 'Accept-Language': 'he' } });
      if (!detailResponse.ok) {
        detailFetchFailures.push({ slug: item.slug, reason: `HTTP ${detailResponse.status}` });
        continue;
      }
      const detailHtml = await detailResponse.text();
      const detail = parseDetailPage(detailHtml);
      if (!detail) {
        detailFetchFailures.push({ slug: item.slug, reason: 'missing_content_text_block' });
        continue;
      }
      records.push({
        slug: item.slug,
        title: item.title,
        termIds: item.termIds,
        description: detail.description,
        priceText: detail.priceText,
        registrationUrl: detail.registrationUrl,
        venueLine: detail.venueLine,
        startsAt: item.startsAtIso,
        endsAt: item.endsAtIso,
        sourceUrl: item.sourceUrl,
      });
    } catch (error) {
      detailFetchFailures.push({ slug: item.slug, reason: (error as Error).message });
    }
  }

  const failureRate = withinHorizon.length === 0 ? 0 : detailFetchFailures.length / withinHorizon.length;
  if (failureRate > DETAIL_FAILURE_TOLERANCE) {
    return {
      records,
      invalidListItems,
      excludedEvergreen,
      detailFetchFailures,
      sourceComplete: false,
      incompleteReason: `detail fetch failure rate ${(failureRate * 100).toFixed(0)}% exceeded the ${(DETAIL_FAILURE_TOLERANCE * 100).toFixed(0)}% tolerance`,
      rawListItemCount: listItems.length,
    };
  }

  return {
    records,
    invalidListItems,
    excludedEvergreen,
    detailFetchFailures,
    sourceComplete: true,
    incompleteReason: null,
    rawListItemCount: listItems.length,
  };
}

function incomplete(rawListItemCount: number, reason: string): TelAvivPortFetchResult {
  return {
    records: [],
    invalidListItems: [],
    excludedEvergreen: [],
    detailFetchFailures: [],
    sourceComplete: false,
    incompleteReason: reason,
    rawListItemCount,
  };
}

/** The CONTENT_MAX_LENGTH hard cap can land mid-tag (confirmed live: a
 *  long real page truncated inside an `<img ...>` tag's attributes,
 *  leaking raw markup into the decoded description text since stripTags's
 *  `<[^>]*>` pattern cannot match a tag whose closing `>` was cut off).
 *  If the slice ends with an unclosed `<`, drop back to before it. */
function trimToLastCompleteTag(html: string): string {
  const lastOpen = html.lastIndexOf('<');
  const lastClose = html.lastIndexOf('>');
  return lastOpen > lastClose ? html.slice(0, lastOpen) : html;
}

function decodeHtmlEntitiesInUrl(url: string): string {
  return url.replace(/&amp;/gi, '&');
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
    .replace(/&#8211;|&#8212;/gi, '-')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
  return decoded || null;
}
