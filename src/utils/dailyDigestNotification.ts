import { jerusalemLocalDateString, weeklyDigestPeriod } from '../../supabase/functions/_shared/dailyDigest/scheduleGate';

export type DailyDigestNotificationRoute =
  | { status: 'valid'; date: string; city: 'tel_aviv'; occurrenceIds: string[] }
  | { status: 'stale' | 'malformed' }
  | { status: 'not_digest' };

export type DigestNotificationRoute =
  | { status: 'valid'; digestType: 'daily'; date: string; city: 'tel_aviv'; occurrenceIds: string[] }
  | { status: 'valid'; digestType: 'weekly'; weekStart: string; city: 'tel_aviv'; occurrenceIds: string[] }
  | { status: 'stale' | 'malformed' }
  | { status: 'not_digest' };

export function parseDigestNotification(
  data: Record<string, unknown> | undefined,
  now: Date = new Date(),
): DigestNotificationRoute {
  if (data?.kind === 'weekly_digest') {
    if (data.type !== 'weekly_digest' || data.city !== 'tel_aviv' || typeof data.week_start !== 'string') {
      return { status: 'malformed' };
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.week_start) || !isRealCalendarDate(data.week_start)) {
      return { status: 'malformed' };
    }
    const occurrenceIds = parseOccurrenceIds(data.occurrence_ids);
    if (occurrenceIds === null) return { status: 'malformed' };
    if (!isWeeklyDigestWeekAvailable(data.week_start, now)) return { status: 'stale' };
    return { status: 'valid', digestType: 'weekly', weekStart: data.week_start, city: 'tel_aviv', occurrenceIds };
  }
  const daily = parseDailyDigestNotification(data, now);
  if (daily.status === 'valid') return { ...daily, digestType: 'daily' };
  return daily;
}

/** Validates the entire push-routing contract before navigation. A stale or
 * malformed Daily Digest notification deliberately falls back to Discovery;
 * it must never open an empty/incorrect modal or reuse today's content for a
 * different date. */
export function parseDailyDigestNotification(
  data: Record<string, unknown> | undefined,
  now: Date = new Date(),
): DailyDigestNotificationRoute {
  if (data?.kind !== 'daily_digest') return { status: 'not_digest' };
  if (data.type !== 'daily_digest' || data.city !== 'tel_aviv' || typeof data.date !== 'string') {
    return { status: 'malformed' };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date) || !isRealCalendarDate(data.date)) {
    return { status: 'malformed' };
  }
  const occurrenceIds = parseOccurrenceIds(data.occurrence_ids);
  if (occurrenceIds === null) return { status: 'malformed' };
  if (!isDailyDigestDateAvailable(data.date, now)) return { status: 'stale' };
  return { status: 'valid', date: data.date, city: 'tel_aviv', occurrenceIds };
}

export function isDailyDigestDateAvailable(date: string | undefined, now: Date = new Date()): date is string {
  return !!date && /^\d{4}-\d{2}-\d{2}$/.test(date) && isRealCalendarDate(date) && date === jerusalemLocalDateString(now);
}

export function isWeeklyDigestWeekAvailable(weekStart: string | undefined, now: Date = new Date()): weekStart is string {
  return !!weekStart
    && /^\d{4}-\d{2}-\d{2}$/.test(weekStart)
    && isRealCalendarDate(weekStart)
    && weekStart === weeklyDigestPeriod(now).weekStart;
}

function isRealCalendarDate(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/** Build 43 and earlier Digest pushes did not carry the persisted selection,
 * so a missing field remains a supported legacy payload. New pushes include
 * the exact persisted occurrence IDs; malformed or oversized arrays fail
 * closed instead of becoming an unbounded database query. */
function parseOccurrenceIds(value: unknown): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.length > 32) return null;
  if (value.some((id) => typeof id !== 'string' || id.length === 0 || id.length > 128)) return null;
  return [...new Set(value as string[])];
}
