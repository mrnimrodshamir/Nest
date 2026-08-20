import { jerusalemLocalDateString } from '../../supabase/functions/_shared/dailyDigest/scheduleGate';

export type DailyDigestNotificationRoute =
  | { status: 'valid'; date: string; city: 'tel_aviv' }
  | { status: 'stale' | 'malformed' }
  | { status: 'not_digest' };

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
  if (!isDailyDigestDateAvailable(data.date, now)) return { status: 'stale' };
  return { status: 'valid', date: data.date, city: 'tel_aviv' };
}

export function isDailyDigestDateAvailable(date: string | undefined, now: Date = new Date()): date is string {
  return !!date && /^\d{4}-\d{2}-\d{2}$/.test(date) && isRealCalendarDate(date) && date === jerusalemLocalDateString(now);
}

function isRealCalendarDate(value: string): boolean {
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}
