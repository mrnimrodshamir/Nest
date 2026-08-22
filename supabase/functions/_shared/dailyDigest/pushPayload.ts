import { buildDigestPushCopy, buildWeeklyDigestPushCopy, buildWeekendDigestPushCopy } from './pushCopy.ts';
import type { DigestType } from './idempotency.ts';

/** Expo push API message shape — the subset this function actually sets.
 *  See https://docs.expo.dev/push-notifications/sending-notifications/. */
export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  data: {
    kind: 'daily_digest' | 'weekly_digest' | 'weekend_digest';
    type: 'daily_digest' | 'weekly_digest' | 'weekend_digest';
    date?: string;
    week_start?: string;
    weekend_local_date?: string;
    occurrence_ids: string[];
    city: 'tel_aviv';
  };
}

export const DAILY_DIGEST_CITY = 'tel_aviv' as const;

/** `nestup://` deep link a tapped push (or a shared link) resolves to. Only
 *  non-sensitive, non-identifying fields — no user id, no event ids, no
 *  coordinates — matching "no private data in the notification payload". */
export function buildDailyDigestDeepLink(localDate: string): string {
  return `nestup://daily-digest?type=daily_digest&date=${encodeURIComponent(localDate)}&city=${DAILY_DIGEST_CITY}`;
}

export function buildWeeklyDigestDeepLink(weekStart: string): string {
  return `nestup://weekly-digest?type=weekly_digest&week_start=${encodeURIComponent(weekStart)}&city=${DAILY_DIGEST_CITY}`;
}

export function buildWeekendDigestDeepLink(weekendStart: string): string {
  return `nestup://weekend-digest?type=weekend_digest&weekend_local_date=${encodeURIComponent(weekendStart)}&city=${DAILY_DIGEST_CITY}`;
}

/** Builds one Expo push message for one user. `eventCount` must be the
 *  number of events actually selected for THIS digest (already computed by
 *  selectDigestEvents), never a hardcoded target. */
export function buildDigestPushMessage(input: {
  expoPushToken: string;
  locale: string | null | undefined;
  localDate: string;
  eventCount: number;
  occurrenceIds?: readonly string[];
}): ExpoPushMessage {
  const { title, body } = buildDigestPushCopy(input.locale, input.eventCount);
  return {
    to: input.expoPushToken,
    title,
    body,
    sound: 'default',
    data: {
      kind: 'daily_digest',
      type: 'daily_digest',
      date: input.localDate,
      occurrence_ids: [...(input.occurrenceIds ?? [])],
      city: DAILY_DIGEST_CITY,
    },
  };
}

export function buildWeeklyDigestPushMessage(input: {
  expoPushToken: string;
  locale: string | null | undefined;
  weekStart: string;
  eventCount: number;
  occurrenceIds?: readonly string[];
}): ExpoPushMessage {
  const { title, body } = buildWeeklyDigestPushCopy(input.locale, input.eventCount);
  return {
    to: input.expoPushToken,
    title,
    body,
    sound: 'default',
    data: {
      kind: 'weekly_digest',
      type: 'weekly_digest',
      week_start: input.weekStart,
      occurrence_ids: [...(input.occurrenceIds ?? [])],
      city: DAILY_DIGEST_CITY,
    },
  };
}

export function buildWeekendDigestPushMessage(input: {
  expoPushToken: string;
  locale: string | null | undefined;
  weekendStart: string;
  eventCount: number;
  occurrenceIds?: readonly string[];
}): ExpoPushMessage {
  const { title, body } = buildWeekendDigestPushCopy(input.locale, input.eventCount);
  return {
    to: input.expoPushToken,
    title,
    body,
    sound: 'default',
    data: {
      kind: 'weekend_digest',
      type: 'weekend_digest',
      weekend_local_date: input.weekendStart,
      occurrence_ids: [...(input.occurrenceIds ?? [])],
      city: DAILY_DIGEST_CITY,
    },
  };
}

export function buildPushMessageForDigest(input: {
  digestType: DigestType;
  expoPushToken: string;
  locale: string | null | undefined;
  anchorDate: string;
  eventCount: number;
  occurrenceIds?: readonly string[];
}): ExpoPushMessage {
  if (input.digestType === 'weekly') return buildWeeklyDigestPushMessage({ ...input, weekStart: input.anchorDate });
  if (input.digestType === 'weekend') return buildWeekendDigestPushMessage({ ...input, weekendStart: input.anchorDate });
  return buildDigestPushMessage({ ...input, localDate: input.anchorDate });
}
