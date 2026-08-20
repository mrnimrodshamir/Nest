import { buildDigestPushCopy } from './pushCopy.ts';

/** Expo push API message shape — the subset this function actually sets.
 *  See https://docs.expo.dev/push-notifications/sending-notifications/. */
export interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  sound: 'default';
  data: {
    kind: 'daily_digest';
    type: 'daily_digest';
    date: string;
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

/** Builds one Expo push message for one user. `eventCount` must be the
 *  number of events actually selected for THIS digest (already computed by
 *  selectDigestEvents), never a hardcoded target. */
export function buildDigestPushMessage(input: {
  expoPushToken: string;
  locale: string | null | undefined;
  localDate: string;
  eventCount: number;
}): ExpoPushMessage {
  const { title, body } = buildDigestPushCopy(input.locale, input.eventCount);
  return {
    to: input.expoPushToken,
    title,
    body,
    sound: 'default',
    data: { kind: 'daily_digest', type: 'daily_digest', date: input.localDate, city: DAILY_DIGEST_CITY },
  };
}
