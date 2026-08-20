/** Daily Digest scheduling is DST-safe by construction: pg_cron itself only
 *  understands UTC, so a fixed "07:00 Asia/Jerusalem" cron expression would
 *  silently drift by an hour every DST transition. Instead the cron job
 *  ticks frequently (every 15 minutes) and this pure gate decides, using the
 *  IANA tz database via Intl (which DOES know about Israel's DST rules),
 *  whether "now" falls inside today's 07:00 Jerusalem send window. */

export const JERUSALEM_TZ = 'Asia/Jerusalem';

interface JerusalemParts {
  year: string;
  month: string;
  day: string;
  hour: number;
  minute: number;
}

function jerusalemParts(nowUtc: Date): JerusalemParts {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: JERUSALEM_TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(nowUtc).map((p) => [p.type, p.value]));
  // Some ICU implementations render midnight as "24" under hour12:false.
  const hour = parts.hour === '24' ? 0 : Number(parts.hour);
  return { year: parts.year, month: parts.month, day: parts.day, hour, minute: Number(parts.minute) };
}

function jerusalemWeekday(nowUtc: Date): number {
  const weekday = new Intl.DateTimeFormat('en-US', {
    timeZone: JERUSALEM_TZ,
    weekday: 'short',
  }).format(nowUtc);
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
}

/** YYYY-MM-DD for "today" in Jerusalem — this, not the UTC date, is what
 *  "today's events" and the idempotency key must use. An event at 00:30
 *  Jerusalem time on the 20th is UTC 21:30 on the 19th, and must still
 *  count as the 20th. */
export function jerusalemLocalDateString(nowUtc: Date): string {
  const { year, month, day } = jerusalemParts(nowUtc);
  return `${year}-${month}-${day}`;
}

/** True exactly once per Jerusalem calendar day, for the `windowMinutes`
 *  stretch starting at 07:00 — e.g. with the default 15-minute window and a
 *  15-minute cron tick, this is true on exactly one tick per day even across
 *  a DST transition, because Intl resolves the Jerusalem wall-clock hour
 *  directly rather than doing UTC arithmetic with a hardcoded offset. */
export function isDailyDigestSendWindow(nowUtc: Date, windowMinutes = 15): boolean {
  const { hour, minute } = jerusalemParts(nowUtc);
  return hour === 7 && minute < windowMinutes;
}

/** Saturday 19:00 in Jerusalem, evaluated against the IANA timezone so the
 * UTC cron tick remains correct across Israeli daylight-saving changes. */
export function isWeeklyDigestSendWindow(nowUtc: Date, windowMinutes = 15): boolean {
  const { hour, minute } = jerusalemParts(nowUtc);
  return jerusalemWeekday(nowUtc) === 6 && hour === 19 && minute < windowMinutes;
}

export function addLocalCalendarDays(localDate: string, days: number): string {
  const [year, month, day] = localDate.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

export interface WeeklyDigestPeriod {
  weekStart: string;
  weekEnd: string;
  days: string[];
}

export function weeklyDigestPeriodFromStart(weekStart: string): WeeklyDigestPeriod {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(weekStart)) throw new Error('Invalid weekly digest start');
  const [year, month, day] = weekStart.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.toISOString().slice(0, 10) !== weekStart || parsed.getUTCDay() !== 0) {
    throw new Error('Weekly digest start must be a real Sunday');
  }
  const days = Array.from({ length: 7 }, (_, index) => addLocalCalendarDays(weekStart, index));
  return { weekStart, weekEnd: days[6], days };
}

/** Returns the Jerusalem-local Sunday-Saturday digest period. Saturday's
 * digest points at the coming week; Sunday-Friday resolve to their current
 * week so a notification remains openable for the whole covered period. */
export function weeklyDigestPeriod(nowUtc: Date): WeeklyDigestPeriod {
  const localDate = jerusalemLocalDateString(nowUtc);
  const weekday = jerusalemWeekday(nowUtc);
  const offsetToSunday = weekday === 6 ? 1 : -weekday;
  const weekStart = addLocalCalendarDays(localDate, offsetToSunday);
  return weeklyDigestPeriodFromStart(weekStart);
}
