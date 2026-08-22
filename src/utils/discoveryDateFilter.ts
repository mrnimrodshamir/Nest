/** Pure date-relevance logic for normal Discovery.
 *
 *  Normal, unfiltered Discovery defaults to a TODAY → NEXT 30 DAYS horizon so
 *  a provider with hundreds of far-future rows cannot crowd out next week's
 *  events. Far-future events are never deleted — they stay reachable through
 *  Search, an explicit date filter, or a direct/deep link straight to Event
 *  Details, none of which go through this horizon at all.
 *
 *  Kept free of any Supabase/React Native import so it is directly
 *  unit-testable, mirroring supabase/functions/_shared/dailyDigest/selectDigestEvents.ts. */

export const DISCOVERY_DEFAULT_HORIZON_DAYS = 30;

export type DiscoveryDateFilterKey =
  | 'next30'
  | 'today'
  | 'tomorrow'
  | 'week'
  | 'weekend'
  | 'next7'
  | 'all';

// Presentation order follows the conceptual relevance ladder from the
// mission brief: today → tomorrow → this week → this weekend → next 7 days →
// rest of the next 30 days (the default) → explicitly everything.
export const DISCOVERY_DATE_FILTERS: readonly DiscoveryDateFilterKey[] = [
  'today', 'tomorrow', 'week', 'weekend', 'next7', 'next30', 'all',
];

export interface DiscoveryDateRange {
  /** Inclusive lower bound, start of local "today". */
  start: Date;
  /** Exclusive upper bound. `null` means unbounded — used only for the
   *  explicit 'all' filter, which is how a far-future Event stays reachable
   *  without ever being deleted. */
  end: Date | null;
}

/** Local-day boundary in Asia/Jerusalem, matching the convention already used
 *  by supabase/functions/_shared/dailyDigest/scheduleGate.ts and
 *  src/lib/events.ts's own startOfLocalDay. Duplicated rather than imported:
 *  the digest module pulls in Deno-oriented scheduling helpers this file has
 *  no reason to depend on, and the calculation itself is three lines. */
function startOfJerusalemDay(now: Date): Date {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit',
  });
  const parts = Object.fromEntries(formatter.formatToParts(now).flatMap((part) => part.type === 'literal' ? [] : [[part.type, part.value]]));
  const approximateUtc = Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
  const offset = jerusalemOffsetMilliseconds(new Date(approximateUtc));
  return new Date(approximateUtc - offset);
}

function jerusalemOffsetMilliseconds(date: Date): number {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jerusalem', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date).flatMap((part) => part.type === 'literal' ? [] : [[part.type, part.value]]));
  return Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day), Number(parts.hour), Number(parts.minute), Number(parts.second)) - date.getTime();
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Jerusalem weekday index, 0=Sunday..6=Saturday — matching the "weekend"
 *  used elsewhere in this codebase (Friday/Saturday, see the Weekend Digest). */
function jerusalemWeekday(date: Date): number {
  const formatter = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', weekday: 'short' });
  const short = formatter.format(date);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(short);
}

/** Resolves a date-filter preset to a concrete [start, end) range.
 *
 *  `end: null` (only for 'all') removes the upper bound entirely — the query
 *  layer must then rely on its normal row limit rather than a date cutoff, so
 *  a far-future Event that a parent explicitly asked for is never hidden. */
export function resolveDiscoveryDateRange(filter: DiscoveryDateFilterKey, now: Date): DiscoveryDateRange {
  const today = startOfJerusalemDay(now);
  switch (filter) {
    case 'today':
      return { start: today, end: addDays(today, 1) };
    case 'tomorrow':
      return { start: addDays(today, 1), end: addDays(today, 2) };
    case 'week': {
      // Rest of the current Sun–Sat week, from today through Saturday night.
      const weekday = jerusalemWeekday(today);
      return { start: today, end: addDays(today, 7 - weekday) };
    }
    case 'weekend': {
      // Nearest Friday–Saturday, matching the Weekend Digest's own
      // definition. Deliberately NOT `((5 - weekday + 7) % 7)`: that always
      // steps forward, so on a Saturday it would skip the weekend already
      // under way and jump a full week ahead. Without the modulo, Saturday
      // (weekday 6) correctly resolves to -1 — yesterday, i.e. this
      // weekend's Friday — while every other day still steps forward to the
      // upcoming Friday.
      const weekday = jerusalemWeekday(today);
      const fridayStart = addDays(today, 5 - weekday);
      return { start: fridayStart, end: addDays(fridayStart, 2) };
    }
    case 'next7':
      return { start: today, end: addDays(today, 7) };
    case 'all':
      return { start: today, end: null };
    case 'next30':
    default:
      return { start: today, end: addDays(today, DISCOVERY_DEFAULT_HORIZON_DAYS) };
  }
}

/** Convenience for callers (tests, non-query call sites) that just want to
 *  know whether an ISO timestamp falls inside a resolved range. */
export function isWithinDiscoveryDateRange(iso: string, range: DiscoveryDateRange): boolean {
  const value = Date.parse(iso);
  if (!Number.isFinite(value)) return false;
  if (value < range.start.getTime()) return false;
  if (range.end !== null && value >= range.end.getTime()) return false;
  return true;
}
