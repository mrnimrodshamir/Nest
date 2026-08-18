/** Tel Aviv Cinematheque connector.
 *
 *  cinema.co.il has no API, RSS/ICS, or JSON-LD event markup (a prior
 *  research pass confirmed this against live network traffic — see
 *  reports/ for that pass). What it does have, confirmed by fetching real
 *  `/shown/?date=YYYY-MM-DD` daily-schedule pages directly:
 *
 *  - Every screening card is a `.festival-grid-box` block whose class
 *    includes a stable `event_id-<N>` token — a WordPress post ID, also
 *    visible on the film's own detail page as `postid-<N>` on `<body>`.
 *    IDENTITY QUESTION RESOLVED (2026-08-19, live evidence, not assumed):
 *    fetched two different date pages (2026-08-21 and 2026-08-22) and
 *    found several titles present on BOTH days — "לוני טונס מציגים: קיוטי
 *    נגד אקמי – מדובב" and "היפהפייה והיחפן – מדובב" among them — and in
 *    every case the `event_id-<N>` token and the film's URL slug were
 *    IDENTICAL across both days. Repeated showtimes of the same film DO
 *    share one stable WordPress identity. Per the brief's decision tree,
 *    that means: one Event, multiple Occurrences, grouped by this id —
 *    never by normalized/translated title, which the same evidence run
 *    also showed CANNOT be trusted alone (the family taxonomy archive page
 *    separately contains numerically-suffixed slugs — "…-2-5", "…-7" — for
 *    same-titled but genuinely different posts, e.g. different editions of
 *    a recurring summer workshop; keying by id rather than title is what
 *    keeps those correctly separate instead of wrongly merged).
 *  - The site's own family taxonomy — `movie-cat-10` in a card's
 *    `grid-data`/class attribute — is the relevance authority, exactly as
 *    instructed: this connector does not independently judge whether a
 *    film "seems" family-appropriate.
 *  - Each showtime within a card is `<a class="cal_link"
 *    data-url=".../order/<ticketId>"><span class="time">HH:MM</span></a>`
 *    — the numeric ticket/order id is a genuinely per-SHOWTIME identifier,
 *    used here as providerTransportId (the occurrence-level fallback
 *    match key), while event_id is the film-level identity.
 *  - Hall is NOT present in this static markup for any family-tagged card
 *    checked live (grep for "אולם" across two full day-pages: zero
 *    matches) — contradicting an earlier, less rigorous research pass.
 *    This connector still tries a defensive `אולם\s*\d+` pattern per the
 *    brief's "hall is occurrence metadata" requirement, but honestly
 *    expect it to resolve null for the foreseeable future; that is a
 *    correct finding about this source, not a parsing gap.
 *  - Price is NEVER extracted — the brief explicitly forbids crawling the
 *    cintlv.pres.global checkout to obtain it, and no price appears on the
 *    schedule pages themselves either (grep for "מחיר": zero matches on
 *    two full day-pages).
 *
 *  ONE FETCH PER DAY IN THE HORIZON — there is no single page listing all
 *  upcoming family screenings with dates; the family taxonomy archive page
 *  (`/event_cat/לכל-המשפחה/`) lists titles without a reliable per-showtime
 *  schedule, so occurrence-level data (time, ticket id) can only come from
 *  the day-by-day `/shown/?date=` pages, which is what this connector
 *  reads directly — it does not need the archive page at all, since every
 *  family-tagged card on a day page already carries the `movie-cat-10` tag
 *  itself.
 *
 *  FAIL-CLOSED: sourceComplete goes false if ANY day in the horizon fails
 *  to fetch or does not look structurally intact — with only 7 requests
 *  total for a 7-day horizon, a single missing day is a meaningfully
 *  incomplete picture, not a tolerable gap the way one flaky detail-page
 *  fetch is for Beit Ariela's much larger request count. */

const BASE_URL = 'https://www.cinema.co.il';
const SCHEDULE_CONTAINER_MARKER = 'festival-filter-wraper';
const CARD_MARKER_PATTERN = /class="festival-grid-box box event_id-(\d+)\s+([^"]*)"/g;
export const FAMILY_TAXONOMY_TAG = 'movie-cat-10';

export class CinemathequeConnectorError extends Error {
  readonly code: 'HTTP_ERROR' | 'STRUCTURAL_DRIFT';
  constructor(code: CinemathequeConnectorError['code'], message: string) {
    super(message);
    this.name = 'CinemathequeConnectorError';
    this.code = code;
  }
}

export interface CinemathequeShowtime {
  ticketId: string;
  time: string; // "HH:MM"
}

export interface CinemathequeCard {
  eventId: string;
  movieCatTags: string[];
  title: string | null;
  sourceUrl: string | null;
  countryYearDuration: string | null;
  director: string | null;
  language: string | null;
  description: string | null;
  hall: string | null;
  showtimes: CinemathequeShowtime[];
}

export interface CinemathequeRawOccurrence {
  eventId: string;
  ticketId: string;
  title: string;
  sourceUrl: string;
  durationMinutes: number | null;
  director: string | null;
  language: string | null;
  country: string | null;
  year: string | null;
  description: string | null;
  hall: string | null;
  startsAt: string; // ISO, Asia/Jerusalem offset applied
}

export interface FetchCinemathequeOptions {
  fetchImpl?: typeof fetch;
  now?: Date;
  horizonDays?: number;
}

export interface CinemathequeFetchResult {
  occurrences: CinemathequeRawOccurrence[];
  daysFetched: number;
  dayFailures: { date: string; reason: string }[];
  sourceComplete: boolean;
  incompleteReason: string | null;
  rawCardCount: number;
}

/* ---------------------------------------------------------------------- */
/* Day-page parsing                                                        */
/* ---------------------------------------------------------------------- */

export function parseDayPage(html: string): CinemathequeCard[] {
  const cards: CinemathequeCard[] = [];
  const starts: { eventId: string; tags: string; index: number }[] = [];
  let match: RegExpExecArray | null;
  const pattern = new RegExp(CARD_MARKER_PATTERN);
  while ((match = pattern.exec(html))) {
    starts.push({ eventId: match[1], tags: match[2], index: match.index });
  }
  for (let i = 0; i < starts.length; i += 1) {
    const start = starts[i].index;
    const end = i + 1 < starts.length ? starts[i + 1].index : html.length;
    const block = html.slice(start, end);
    cards.push(parseCardBlock(starts[i].eventId, starts[i].tags, block));
  }
  return cards;
}

function parseCardBlock(eventId: string, tagsRaw: string, block: string): CinemathequeCard {
  const movieCatTags = tagsRaw.split(/\s+/).filter((token) => token.startsWith('movie-cat-'));
  const titleMatch = block.match(/<h3><a href="([^"]+)">([\s\S]*?)<\/a><\/h3>/);
  const metaMatch = block.match(/<p>([^<]*?\/[^<]*?\/[^<]*?אורך:\d+)<\/p>/);
  const directorMatch = block.match(/בימוי:([^<]*?)</);
  const languageMatch = block.match(/שפה:([^<]*?)</);
  const descriptionMatch = block.match(/<div class="paragraph">[\s\S]*?<p>([\s\S]*?)<\/p>/);
  const hallMatch = block.match(/אולם\s*(\d+)/);

  const showtimes: CinemathequeShowtime[] = [];
  const showtimePattern = /<a class="cal_link" data-url="https:\/\/cintlv\.pres\.global\/order\/(\d+)"[^>]*><span class="time">(\d{1,2}:\d{2})<\/span>/g;
  let showtimeMatch: RegExpExecArray | null;
  while ((showtimeMatch = showtimePattern.exec(block))) {
    showtimes.push({ ticketId: showtimeMatch[1], time: showtimeMatch[2] });
  }

  return {
    eventId,
    movieCatTags,
    title: decodeHtml(titleMatch?.[2] ?? null),
    sourceUrl: titleMatch ? titleMatch[1] : null,
    countryYearDuration: decodeHtml(metaMatch?.[1] ?? null),
    director: decodeHtml(directorMatch?.[1]?.trim() ?? null),
    language: decodeHtml(languageMatch?.[1]?.trim() ?? null),
    description: decodeHtml(descriptionMatch?.[1] ?? null),
    hall: hallMatch ? hallMatch[1] : null,
    showtimes,
  };
}

export function isFamilyTagged(card: CinemathequeCard): boolean {
  return card.movieCatTags.includes(FAMILY_TAXONOMY_TAG);
}

export function parseDurationMinutes(countryYearDuration: string | null): number | null {
  const match = countryYearDuration?.match(/אורך:(\d+)/);
  return match ? Number(match[1]) : null;
}

export function parseYear(countryYearDuration: string | null): string | null {
  const match = countryYearDuration?.match(/\/\s*(\d{4})\s*\//);
  return match ? match[1] : null;
}

export function parseCountry(countryYearDuration: string | null): string | null {
  const match = countryYearDuration?.match(/^([^/]+)\//);
  return match ? match[1].trim() : null;
}

/* ---------------------------------------------------------------------- */
/* Orchestration                                                           */
/* ---------------------------------------------------------------------- */

export async function fetchCinemathequeCandidates(options: FetchCinemathequeOptions = {}): Promise<CinemathequeFetchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? new Date();
  const horizonDays = Math.max(1, Math.min(30, options.horizonDays ?? 7));

  const occurrences: CinemathequeRawOccurrence[] = [];
  const dayFailures: { date: string; reason: string }[] = [];
  let rawCardCount = 0;
  let daysFetched = 0;

  for (let offset = 0; offset < horizonDays; offset += 1) {
    const dateIso = isoDateFor(now, offset);
    const url = `${BASE_URL}/shown/?date=${dateIso}`;
    let response: Response;
    try {
      response = await fetchImpl(url, { headers: { Accept: 'text/html', 'Accept-Language': 'he' } });
    } catch (error) {
      dayFailures.push({ date: dateIso, reason: `network error: ${(error as Error).message}` });
      continue;
    }
    if (!response.ok) {
      dayFailures.push({ date: dateIso, reason: `HTTP ${response.status}` });
      continue;
    }
    const html = await response.text();
    if (!html.includes(SCHEDULE_CONTAINER_MARKER)) {
      dayFailures.push({ date: dateIso, reason: 'page did not contain the expected schedule container' });
      continue;
    }
    daysFetched += 1;
    const cards = parseDayPage(html);
    rawCardCount += cards.length;

    for (const card of cards) {
      if (!isFamilyTagged(card)) continue;
      if (!card.title || !card.sourceUrl) continue;
      const durationMinutes = parseDurationMinutes(card.countryYearDuration);
      for (const showtime of card.showtimes) {
        const startsAt = combineDateAndTime(dateIso, showtime.time);
        if (!startsAt) continue;
        occurrences.push({
          eventId: card.eventId,
          ticketId: showtime.ticketId,
          title: card.title,
          sourceUrl: card.sourceUrl,
          durationMinutes,
          director: card.director,
          language: card.language,
          country: parseCountry(card.countryYearDuration),
          year: parseYear(card.countryYearDuration),
          description: card.description,
          hall: card.hall,
          startsAt,
        });
      }
    }
  }

  const sourceComplete = dayFailures.length === 0;
  return {
    occurrences,
    daysFetched,
    dayFailures,
    sourceComplete,
    incompleteReason: sourceComplete ? null : `${dayFailures.length} of ${horizonDays} day(s) failed to fetch cleanly`,
    rawCardCount,
  };
}

function isoDateFor(base: Date, offsetDays: number): string {
  const copy = new Date(base);
  copy.setUTCDate(copy.getUTCDate() + offsetDays);
  return copy.toISOString().slice(0, 10);
}

/** Asia/Jerusalem is +03:00 in August (IDT) — same fixed-offset
 *  simplification beitAriela/connector.ts already uses for its own
 *  local-time source, not something this connector introduces new. */
function combineDateAndTime(dateIso: string, time: string): string | null {
  const iso = `${dateIso}T${time}:00+03:00`;
  return Number.isFinite(Date.parse(iso)) ? iso : null;
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
