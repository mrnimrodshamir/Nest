import {
  selectDigestEvents,
  TEL_AVIV_CENTER,
  DEFAULT_DIGEST_RADIUS_KM,
  DEFAULT_DIGEST_MIN_RESULTS,
  DEFAULT_DIGEST_MAX_RESULTS,
  type DigestCandidateOccurrence,
} from '../_shared/dailyDigest/selectDigestEvents.ts';
import {
  buildWeeklySocialDigest,
  selectWeeklyDigestEvents,
  type WeeklySocialDigest,
} from '../_shared/dailyDigest/selectWeeklyDigestEvents.ts';
import { jerusalemLocalDateString, weeklyDigestPeriod, weeklyDigestPeriodFromStart } from '../_shared/dailyDigest/scheduleGate.ts';
import {
  buildDigestSendKey,
  DIGEST_TYPE_DAILY,
  DIGEST_TYPE_WEEKLY,
  type DigestType,
} from '../_shared/dailyDigest/idempotency.ts';
import { buildPushMessageForDigest, type ExpoPushMessage } from '../_shared/dailyDigest/pushPayload.ts';

export interface EligibleDigestUser {
  userId: string;
  expoPushToken: string | null;
  locale: string | null;
}

export type PushSendOutcome = { status: 'ok' } | { status: 'invalid_token' | 'error'; message: string };

export interface DigestPeriod {
  digestType: DigestType;
  anchorDate: string;
  startDate: string;
  endDate: string;
  days: string[];
}

export interface DigestDatabase {
  fetchCandidates?(period: DigestPeriod): Promise<DigestCandidateOccurrence[]>;
  /** Kept for existing Daily test adapters and deployment compatibility. */
  fetchTodayCandidates?(localDate: string): Promise<DigestCandidateOccurrence[]>;
  fetchEligibleUsers(digestType?: DigestType): Promise<EligibleDigestUser[]>;
  hasAlreadySent(sendKey: string): Promise<boolean>;
  recordDigestInstance(input: {
    digestType?: DigestType;
    anchorDate?: string;
    localDate: string;
    city: string;
    selectedOccurrenceIds: readonly string[];
    selectionVersion: number;
  }): Promise<string>;
  claimSend(input: {
    sendKey: string;
    userId: string;
    digestId: string;
    digestType?: DigestType;
    localDate: string;
  }): Promise<boolean>;
  markSendSucceeded(sendKey: string): Promise<void>;
  markSendFailed(sendKey: string, failureCode: string): Promise<void>;
  removeInvalidPushToken(userId: string, token: string): Promise<void>;
  trackAnalytics(eventName: string, properties: Record<string, unknown>): Promise<void>;
}

export interface PushSender {
  send(messages: readonly ExpoPushMessage[]): Promise<PushSendOutcome[]>;
}

export interface RunDailyDigestInput {
  dryRun: boolean;
  now: Date;
}

export interface RunDigestInput extends RunDailyDigestInput {
  digestType: DigestType;
  city?: string;
  weekStart?: string;
}

export interface RunDailyDigestResult {
  digestType: DigestType;
  localDate: string;
  periodStart: string;
  periodEnd: string;
  eventsConsidered: number;
  eventsEligible: number;
  eventsSelected: number;
  selectedOccurrenceIds: string[];
  selectedEvents: Array<{ occurrenceId: string; title: string; provider: string; category: string; localDate: string }>;
  selectedPerDay: Record<string, number>;
  providerMix: Record<string, number>;
  categoryMix: Record<string, number>;
  eligibleUsers: number;
  validPushUsers: number;
  localesSeen: Record<string, number>;
  wouldSend: number;
  sent: number;
  skipped: number;
  failed: number;
  errors: string[];
  socialOutput: WeeklySocialDigest | null;
}

export function runDailyDigest(
  input: RunDailyDigestInput,
  database: DigestDatabase,
  pushSender: PushSender,
): Promise<RunDailyDigestResult> {
  return runDigest({ ...input, digestType: DIGEST_TYPE_DAILY }, database, pushSender);
}

export function runWeeklyDigest(
  input: RunDailyDigestInput,
  database: DigestDatabase,
  pushSender: PushSender,
): Promise<RunDailyDigestResult> {
  return runDigest({ ...input, digestType: DIGEST_TYPE_WEEKLY }, database, pushSender);
}

/** One orchestration path for Daily and Weekly. Selection and copy vary by
 * digest type; preference, idempotency, delivery, token cleanup, and failure
 * handling remain shared and therefore cannot drift. */
export async function runDigest(
  input: RunDigestInput,
  database: DigestDatabase,
  pushSender: PushSender,
): Promise<RunDailyDigestResult> {
  const city = input.city ?? 'tel_aviv';
  const dailyDate = jerusalemLocalDateString(input.now);
  const week = input.weekStart
    ? weeklyDigestPeriodFromStart(input.weekStart)
    : weeklyDigestPeriod(input.now);
  const period: DigestPeriod = input.digestType === DIGEST_TYPE_WEEKLY
    ? { digestType: input.digestType, anchorDate: week.weekStart, startDate: week.weekStart, endDate: week.weekEnd, days: week.days }
    : { digestType: input.digestType, anchorDate: dailyDate, startDate: dailyDate, endDate: dailyDate, days: [dailyDate] };
  const candidates = database.fetchCandidates
    ? await database.fetchCandidates(period)
    : await database.fetchTodayCandidates!(period.anchorDate);
  const weeklySelection = input.digestType === DIGEST_TYPE_WEEKLY
    ? selectWeeklyDigestEvents(candidates, week)
    : null;
  const selected = weeklySelection?.events ?? selectDigestEvents(candidates, {
    localDate: dailyDate,
    targetLatitude: TEL_AVIV_CENTER.latitude,
    targetLongitude: TEL_AVIV_CENTER.longitude,
    maxRadiusKm: DEFAULT_DIGEST_RADIUS_KM,
    minResults: DEFAULT_DIGEST_MIN_RESULTS,
    maxResults: DEFAULT_DIGEST_MAX_RESULTS,
  });

  const prefix = input.digestType === DIGEST_TYPE_WEEKLY ? 'weekly' : 'daily';
  const dateProperty = input.digestType === DIGEST_TYPE_WEEKLY ? 'week_start' : 'date';
  const track = input.dryRun
    ? async (_eventName: string, _properties: Record<string, unknown>) => undefined
    : database.trackAnalytics.bind(database);
  const providerMix: Record<string, number> = {};
  const categoryMix: Record<string, number> = {};
  const selectedPerDay = Object.fromEntries(period.days.map((day) => [day, 0]));
  for (const event of selected) {
    providerMix[event.provider] = (providerMix[event.provider] ?? 0) + 1;
    categoryMix[event.category] = (categoryMix[event.category] ?? 0) + 1;
    const day = jerusalemDateOf(event.startsAt);
    if (day in selectedPerDay) selectedPerDay[day] += 1;
  }

  await track(`${prefix}_digest_generated`, {
    [dateProperty]: period.anchorDate,
    city,
    result_count: selected.length,
  });

  const result: RunDailyDigestResult = {
    digestType: input.digestType,
    localDate: period.anchorDate,
    periodStart: period.startDate,
    periodEnd: period.endDate,
    eventsConsidered: candidates.length,
    eventsEligible: weeklySelection?.eligibleCount ?? selected.length,
    eventsSelected: selected.length,
    selectedOccurrenceIds: selected.map((event) => event.occurrenceId),
    selectedEvents: selected.map((event) => ({
      occurrenceId: event.occurrenceId,
      title: event.title,
      provider: event.provider,
      category: event.category,
      localDate: jerusalemDateOf(event.startsAt),
    })),
    selectedPerDay,
    providerMix,
    categoryMix,
    eligibleUsers: 0,
    validPushUsers: 0,
    localesSeen: {},
    wouldSend: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    errors: [],
    socialOutput: weeklySelection ? buildWeeklySocialDigest(weeklySelection, city) : null,
  };

  if (selected.length === 0) return result;

  const users = await database.fetchEligibleUsers(input.digestType);
  result.eligibleUsers = users.length;
  for (const user of users) {
    const locale = user.locale ?? 'en';
    result.localesSeen[locale] = (result.localesSeen[locale] ?? 0) + 1;
  }
  await track(`${prefix}_push_eligible`, {
    [dateProperty]: period.anchorDate,
    city,
    result_count: users.length,
  });
  if (users.length === 0) return result;

  const digestId = input.dryRun ? null : await database.recordDigestInstance({
    digestType: input.digestType,
    anchorDate: period.anchorDate,
    localDate: period.anchorDate,
    city,
    selectedOccurrenceIds: result.selectedOccurrenceIds,
    selectionVersion: input.digestType === DIGEST_TYPE_WEEKLY ? 2 : 1,
  });

  const toSend: Array<{
    user: EligibleDigestUser & { expoPushToken: string };
    message: ExpoPushMessage;
    sendKey: string;
  }> = [];
  const seenTokens = new Set<string>();
  for (const user of users) {
    const locale = user.locale ?? 'en';
    if (!user.expoPushToken || seenTokens.has(user.expoPushToken)) {
      result.skipped += 1;
      await track(`${prefix}_push_skipped`, {
        [dateProperty]: period.anchorDate,
        city,
        locale,
        reason: user.expoPushToken ? 'duplicate_token' : 'missing_token',
      });
      continue;
    }
    seenTokens.add(user.expoPushToken);
    result.validPushUsers += 1;
    const sendKey = buildDigestSendKey(user.userId, input.digestType, period.anchorDate);
    if (await database.hasAlreadySent(sendKey)) {
      result.skipped += 1;
      await track(`${prefix}_push_skipped`, {
        [dateProperty]: period.anchorDate,
        city,
        locale,
        reason: 'already_sent',
      });
      continue;
    }
    const message = buildPushMessageForDigest({
      digestType: input.digestType,
      expoPushToken: user.expoPushToken,
      locale: user.locale,
      anchorDate: period.anchorDate,
      eventCount: selected.length,
      occurrenceIds: result.selectedOccurrenceIds,
    });
    if (input.dryRun) {
      result.wouldSend += 1;
      continue;
    }
    const claimed = await database.claimSend({
      sendKey,
      userId: user.userId,
      digestId: digestId as string,
      digestType: input.digestType,
      localDate: period.anchorDate,
    });
    if (!claimed) {
      result.skipped += 1;
      await track(`${prefix}_push_skipped`, {
        [dateProperty]: period.anchorDate,
        city,
        locale,
        reason: 'already_claimed',
      });
      continue;
    }
    toSend.push({ user: user as EligibleDigestUser & { expoPushToken: string }, message, sendKey });
  }

  if (input.dryRun || toSend.length === 0) return result;
  const outcomes = await pushSender.send(toSend.map((entry) => entry.message));
  for (let index = 0; index < toSend.length; index += 1) {
    const { user, sendKey } = toSend[index];
    const outcome = outcomes[index];
    if (!outcome || outcome.status !== 'ok') {
      result.failed += 1;
      const failureCode = outcome?.status === 'invalid_token'
        ? 'invalid_token'
        : outcome ? 'push_error' : 'missing_push_result';
      result.errors.push(failureCode);
      await database.markSendFailed(sendKey, failureCode);
      if (outcome?.status === 'invalid_token') {
        await database.removeInvalidPushToken(user.userId, user.expoPushToken);
      }
      await track(`${prefix}_push_failed`, {
        [dateProperty]: period.anchorDate,
        city,
        locale: user.locale ?? 'en',
      });
      continue;
    }
    result.sent += 1;
    await database.markSendSucceeded(sendKey);
    await track(`${prefix}_push_sent`, {
      [dateProperty]: period.anchorDate,
      city,
      locale: user.locale ?? 'en',
      result_count: selected.length,
    });
  }
  return result;
}

function jerusalemDateOf(iso: string): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(iso));
}
