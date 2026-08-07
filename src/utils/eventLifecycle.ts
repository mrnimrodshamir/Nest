import type { EventLifecycleStatus, EventSourceStatus } from '@/types/event';

export interface EventLifecycleInput {
  eventStatus: EventSourceStatus;
  occurrenceStatus: EventSourceStatus;
  startsAt: string;
  endsAt: string | null;
  timezone?: string;
}

export function resolveEventLifecycle(input: EventLifecycleInput, now = new Date()): EventLifecycleStatus {
  if (input.occurrenceStatus === 'cancelled' || input.eventStatus === 'cancelled') return 'cancelled';
  if (input.occurrenceStatus === 'postponed' || input.eventStatus === 'postponed') return 'postponed';

  const start = parseTime(input.startsAt, 'startsAt');
  const end = input.endsAt == null ? null : parseTime(input.endsAt, 'endsAt');
  if (end != null && end < start) throw new Error('Event occurrence endsAt must not precede startsAt');

  // Validate the timezone BEFORE any lifecycle short-circuit. It used to be
  // checked only inside calendarDateKey on the 'today' branch below, which is
  // unreachable once an event is live or finished — so a malformed timezone
  // silently produced a lifecycle result instead of failing. Ingested source
  // data is exactly where malformed timezones arrive, so validation must not
  // depend on which branch a given event happens to take.
  const timezone = input.timezone ?? 'Asia/Jerusalem';
  assertValidTimezone(timezone);

  const current = now.getTime();
  if (end != null && current >= start && current < end) return 'live';
  if (current >= (end ?? start)) return 'finished';
  if (calendarDateKey(now, timezone) === calendarDateKey(new Date(start), timezone)) return 'today';
  return 'upcoming';
}

export const EVENT_LIFECYCLE_LABELS: Record<EventLifecycleStatus, string> = {
  upcoming: 'Upcoming',
  today: 'Today',
  live: 'Live',
  finished: 'Finished',
  cancelled: 'Cancelled',
  postponed: 'Postponed',
};

function parseTime(value: string, field: string): number {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`Invalid event ${field}`);
  return parsed;
}

/** Throws on an unusable IANA zone. Kept separate from calendarDateKey so it
 *  can run unconditionally rather than only on the branch that formats a date. */
function assertValidTimezone(timezone: string): void {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: timezone });
  } catch {
    throw new Error(`Invalid event timezone: ${timezone}`);
  }
}

function calendarDateKey(date: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
  } catch {
    throw new Error(`Invalid event timezone: ${timezone}`);
  }
}
