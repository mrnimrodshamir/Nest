import {
  selectDigestEvents,
  TEL_AVIV_CENTER,
  DEFAULT_DIGEST_RADIUS_KM,
  DEFAULT_DIGEST_MIN_RESULTS,
  DEFAULT_DIGEST_MAX_RESULTS,
  type DigestCandidateOccurrence,
} from '../_shared/dailyDigest/selectDigestEvents.ts';
import { jerusalemLocalDateString } from '../_shared/dailyDigest/scheduleGate.ts';
import { buildDigestSendKey, DIGEST_TYPE_DAILY } from '../_shared/dailyDigest/idempotency.ts';
import { buildDigestPushMessage, type ExpoPushMessage } from '../_shared/dailyDigest/pushPayload.ts';

export interface EligibleDigestUser {
  userId: string;
  expoPushToken: string | null;
  locale: string | null;
}

export type PushSendOutcome = { status: 'ok' } | { status: 'invalid_token' | 'error'; message: string };

export interface DigestDatabase {
  /** Already filtered to today's Tel Aviv candidates via
   *  active_event_occurrences plus a generous date/radius pre-filter — the
   *  remaining precise filtering/ranking happens in selectDigestEvents. */
  fetchTodayCandidates(localDate: string): Promise<DigestCandidateOccurrence[]>;
  /** Already filtered server-side to: valid (non-expired-looking) push
   *  token, notifications enabled, `daily_digest` preference true, account
   *  not deleted/disabled, and a supported app locale (falls back to 'en'
   *  in the row itself only if unset — never guessed here). */
  fetchEligibleUsers(): Promise<EligibleDigestUser[]>;
  hasAlreadySent(sendKey: string): Promise<boolean>;
  recordDigestInstance(input: { localDate: string; city: string; selectedOccurrenceIds: readonly string[]; selectionVersion: number }): Promise<string>;
  /** Atomically reserves this user's logical daily send before any network
   *  call. False means another invocation already owns/completed it. */
  claimSend(input: { sendKey: string; userId: string; digestId: string; localDate: string }): Promise<boolean>;
  markSendSucceeded(sendKey: string): Promise<void>;
  markSendFailed(sendKey: string, failureCode: string): Promise<void>;
  removeInvalidPushToken(userId: string, token: string): Promise<void>;
  trackAnalytics(eventName: string, properties: Record<string, unknown>): Promise<void>;
}

export interface PushSender {
  /** Outcomes MUST be returned in the same order as `messages` — Expo's own
   *  push API is positional (an array of tickets matching the array of
   *  messages sent), and the handler zips them back to users by index. */
  send(messages: readonly ExpoPushMessage[]): Promise<PushSendOutcome[]>;
}

export interface RunDailyDigestInput {
  dryRun: boolean;
  now: Date;
}

export interface RunDailyDigestResult {
  localDate: string;
  eventsConsidered: number;
  eventsSelected: number;
  selectedOccurrenceIds: string[];
  selectedEvents: Array<{ occurrenceId: string; title: string; provider: string }>;
  providerMix: Record<string, number>;
  eligibleUsers: number;
  validPushUsers: number;
  localesSeen: Record<string, number>;
  wouldSend: number;
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
}

/** Orchestrates one Daily Digest tick. Pure aside from the injected
 *  `database`/`pushSender` dependencies, so the exact same code path runs in
 *  a dry run, a real send, and unit tests — no code path is dry-run-only. */
export async function runDailyDigest(
  input: RunDailyDigestInput,
  database: DigestDatabase,
  pushSender: PushSender,
): Promise<RunDailyDigestResult> {
  // A dry run is strictly read-only: no push, digest/send row, token cleanup,
  // or analytics write. This lets production data be inspected safely.
  const trackAnalytics = input.dryRun
    ? async (_eventName: string, _properties: Record<string, unknown>) => undefined
    : database.trackAnalytics.bind(database);
  const localDate = jerusalemLocalDateString(input.now);
  const candidates = await database.fetchTodayCandidates(localDate);
  const selected = selectDigestEvents(candidates, {
    localDate,
    targetLatitude: TEL_AVIV_CENTER.latitude,
    targetLongitude: TEL_AVIV_CENTER.longitude,
    maxRadiusKm: DEFAULT_DIGEST_RADIUS_KM,
    minResults: DEFAULT_DIGEST_MIN_RESULTS,
    maxResults: DEFAULT_DIGEST_MAX_RESULTS,
  });

  const providerMix: Record<string, number> = {};
  for (const event of selected) providerMix[event.provider] = (providerMix[event.provider] ?? 0) + 1;

  await trackAnalytics('daily_digest_generated', {
    date: localDate,
    city: 'tel_aviv',
    result_count: selected.length,
  });

  const result: RunDailyDigestResult = {
    localDate,
    eventsConsidered: candidates.length,
    eventsSelected: selected.length,
    selectedOccurrenceIds: selected.map((e) => e.occurrenceId),
    selectedEvents: selected.map((event) => ({ occurrenceId: event.occurrenceId, title: event.title, provider: event.provider })),
    providerMix,
    eligibleUsers: 0,
    validPushUsers: 0,
    localesSeen: {},
    wouldSend: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  // Never fabricate filler content and never send an empty digest.
  if (selected.length === 0) return result;

  const users = await database.fetchEligibleUsers();
  result.eligibleUsers = users.length;
  for (const user of users) {
    const locale = user.locale ?? 'en';
    result.localesSeen[locale] = (result.localesSeen[locale] ?? 0) + 1;
  }
  await trackAnalytics('daily_push_eligible', { date: localDate, city: 'tel_aviv', result_count: users.length });

  if (users.length === 0) return result;

  const digestId = input.dryRun
    ? null
    : await database.recordDigestInstance({
      localDate,
      city: 'tel_aviv',
      selectedOccurrenceIds: result.selectedOccurrenceIds,
      selectionVersion: 1,
    });

  const toSend: { user: EligibleDigestUser & { expoPushToken: string }; message: ExpoPushMessage; sendKey: string }[] = [];
  const seenTokens = new Set<string>();
  for (const user of users) {
    if (!user.expoPushToken || seenTokens.has(user.expoPushToken)) {
      result.skipped += 1;
      await trackAnalytics('daily_push_skipped', {
        date: localDate,
        city: 'tel_aviv',
        locale: user.locale ?? 'en',
        reason: user.expoPushToken ? 'duplicate_token' : 'missing_token',
      });
      continue;
    }
    seenTokens.add(user.expoPushToken);
    result.validPushUsers += 1;
    const sendKey = buildDigestSendKey(user.userId, DIGEST_TYPE_DAILY, localDate);
    if (await database.hasAlreadySent(sendKey)) {
      result.skipped += 1;
      await trackAnalytics('daily_push_skipped', { date: localDate, city: 'tel_aviv', locale: user.locale ?? 'en' });
      continue;
    }
    const message = buildDigestPushMessage({
      expoPushToken: user.expoPushToken,
      locale: user.locale,
      localDate,
      eventCount: selected.length,
    });
    if (input.dryRun) {
      result.wouldSend += 1;
      continue;
    }
    const claimed = await database.claimSend({ sendKey, userId: user.userId, digestId: digestId as string, localDate });
    if (!claimed) {
      result.skipped += 1;
      await trackAnalytics('daily_push_skipped', { date: localDate, city: 'tel_aviv', locale: user.locale ?? 'en', reason: 'already_claimed' });
      continue;
    }
    toSend.push({ user: user as EligibleDigestUser & { expoPushToken: string }, message, sendKey });
  }

  if (input.dryRun || toSend.length === 0) return result;

  const outcomes = await pushSender.send(toSend.map((t) => t.message));

  for (let i = 0; i < toSend.length; i += 1) {
    const { user, sendKey } = toSend[i];
    const outcome = outcomes[i];
    if (!outcome || outcome.status !== 'ok') {
      result.failed += 1;
      const failureCode = outcome?.status === 'invalid_token' ? 'invalid_token' : outcome ? 'push_error' : 'missing_push_result';
      result.errors.push(failureCode);
      await database.markSendFailed(sendKey, failureCode);
      if (outcome?.status === 'invalid_token') await database.removeInvalidPushToken(user.userId, user.expoPushToken);
      await trackAnalytics('daily_push_failed', { date: localDate, city: 'tel_aviv', locale: user.locale ?? 'en' });
      continue;
    }
    result.sent += 1;
    await database.markSendSucceeded(sendKey);
    await trackAnalytics('daily_push_sent', { date: localDate, city: 'tel_aviv', locale: user.locale ?? 'en', result_count: selected.length });
  }

  return result;
}
