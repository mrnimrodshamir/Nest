import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runDailyDigest, runWeeklyDigest, runWeekendDigest, type DigestDatabase, type EligibleDigestUser, type PushSender, type PushSendOutcome } from './handler.ts';
import { TEL_AVIV_CENTER, type DigestCandidateOccurrence } from '../_shared/dailyDigest/selectDigestEvents.ts';
import { buildDigestSendKey, DIGEST_TYPE_DAILY, DIGEST_TYPE_WEEKLY, DIGEST_TYPE_WEEKEND, type DigestType } from '../_shared/dailyDigest/idempotency.ts';

const NOW = new Date('2026-08-20T04:05:00Z'); // 07:05 Jerusalem (IDT)
const LOCAL_DATE = '2026-08-20';

function occurrence(overrides: Partial<DigestCandidateOccurrence> = {}): DigestCandidateOccurrence {
  return {
    occurrenceId: overrides.occurrenceId ?? `occ-${Math.random()}`,
    eventId: 'event-1',
    title: 'Story time',
    category: 'story_time',
    startsAt: `${LOCAL_DATE}T10:00:00+03:00`,
    ageMinMonths: 12,
    ageMaxMonths: 48,
    priceNote: 'Free',
    provider: 'tel_aviv_digitel',
    sourceName: 'Tel Aviv Municipality',
    sourceType: 'municipal',
    canonicalEventId: null,
    latitude: TEL_AVIV_CENTER.latitude,
    longitude: TEL_AVIV_CENTER.longitude,
    locationName: 'Beit Ariela',
    ...overrides,
  };
}

/** In-memory fake standing in for the real Supabase-backed DigestDatabase —
 *  same contract, so the exact orchestration in handler.ts is exercised. */
function fakeDatabase(input: {
  candidates: DigestCandidateOccurrence[];
  users: EligibleDigestUser[];
  alreadySent?: Set<string>;
}): { db: DigestDatabase; analytics: Array<{ event: string; properties: Record<string, unknown> }>; sends: Array<{ sendKey: string; userId: string }>; completed: string[]; failedClaims: string[]; removedTokens: string[]; requestedDigestTypes: DigestType[] } {
  const analytics: Array<{ event: string; properties: Record<string, unknown> }> = [];
  const sends: Array<{ sendKey: string; userId: string }> = [];
  const completed: string[] = [];
  const failedClaims: string[] = [];
  const removedTokens: string[] = [];
  const requestedDigestTypes: DigestType[] = [];
  const alreadySent = input.alreadySent ?? new Set<string>();
  const db: DigestDatabase = {
    async fetchTodayCandidates() { return input.candidates; },
    async fetchEligibleUsers(digestType = DIGEST_TYPE_DAILY) { requestedDigestTypes.push(digestType); return input.users; },
    async hasAlreadySent(sendKey) { return alreadySent.has(sendKey); },
    async recordDigestInstance() { return 'digest-instance-1'; },
    async claimSend(record) {
      if (alreadySent.has(record.sendKey)) return false;
      alreadySent.add(record.sendKey);
      sends.push({ sendKey: record.sendKey, userId: record.userId });
      return true;
    },
    async markSendSucceeded(sendKey) { completed.push(sendKey); },
    async markSendFailed(sendKey) { failedClaims.push(sendKey); },
    async removeInvalidPushToken(_userId, token) { removedTokens.push(token); },
    async trackAnalytics(event, properties) { analytics.push({ event, properties }); },
  };
  return { db, analytics, sends, completed, failedClaims, removedTokens, requestedDigestTypes };
}

function okPushSender(): PushSender {
  return { async send(messages) { return messages.map(() => ({ status: 'ok' as const })); } };
}

test('0 valid events sends nothing and never writes a digest instance', async () => {
  const { db, analytics } = fakeDatabase({ candidates: [], users: [{ userId: 'u1', expoPushToken: 't1', locale: 'en' }] });
  const result = await runDailyDigest({ dryRun: false, now: NOW }, db, okPushSender());
  assert.equal(result.eventsSelected, 0);
  assert.equal(result.sent, 0);
  assert.equal(result.eligibleUsers, 0, 'must not even look up eligible users when there is nothing to send');
  assert.ok(analytics.some((a) => a.event === 'daily_digest_generated' && a.properties.result_count === 0));
});

test('2 valid events sends a digest with exactly 2 events to eligible users', async () => {
  const { db } = fakeDatabase({
    candidates: [occurrence({ occurrenceId: 'a' }), occurrence({ occurrenceId: 'b', category: 'workshop' })],
    users: [{ userId: 'u1', expoPushToken: 't1', locale: 'en' }],
  });
  let pushedOccurrenceIds: string[] = [];
  const sender: PushSender = {
    async send(messages) {
      pushedOccurrenceIds = messages[0]?.data.occurrence_ids ?? [];
      return messages.map(() => ({ status: 'ok' as const }));
    },
  };
  const result = await runDailyDigest({ dryRun: false, now: NOW }, db, sender);
  assert.equal(result.eventsSelected, 2);
  assert.equal(result.sent, 1);
  assert.deepEqual(pushedOccurrenceIds, result.selectedOccurrenceIds, 'push must carry the persisted selection in order');
});

test('a dry run sends nothing but reports what WOULD send', async () => {
  const { db, sends, analytics } = fakeDatabase({
    candidates: [occurrence()],
    users: [{ userId: 'u1', expoPushToken: 't1', locale: 'en' }, { userId: 'u2', expoPushToken: 't2', locale: 'he' }],
  });
  let pushSenderCalled = false;
  const pushSender: PushSender = { async send(messages) { pushSenderCalled = true; return messages.map(() => ({ status: 'ok' as const })); } };
  const result = await runDailyDigest({ dryRun: true, now: NOW }, db, pushSender);
  assert.equal(result.wouldSend, 2);
  assert.equal(result.sent, 0);
  assert.equal(pushSenderCalled, false, 'dry run must never call the real push sender');
  assert.equal(sends.length, 0, 'dry run must never write a send record');
  assert.equal(analytics.length, 0, 'dry run must not write analytics');
  assert.equal(result.selectedEvents[0]?.startsAt, `${LOCAL_DATE}T10:00:00+03:00`);
  assert.equal(result.selectedEvents[0]?.locationName, 'Beit Ariela');
  assert.match(result.selectedEvents[0]?.whySelected ?? '', /family age data/);
});

test('a user already sent today (idempotency) is skipped, not re-sent', async () => {
  const sendKey = buildDigestSendKey('u1', DIGEST_TYPE_DAILY, LOCAL_DATE);
  const { db } = fakeDatabase({
    candidates: [occurrence()],
    users: [{ userId: 'u1', expoPushToken: 't1', locale: 'en' }],
    alreadySent: new Set([sendKey]),
  });
  let sendCallCount = 0;
  const pushSender: PushSender = { async send(messages) { sendCallCount += 1; return messages.map(() => ({ status: 'ok' as const })); } };
  const result = await runDailyDigest({ dryRun: false, now: NOW }, db, pushSender);
  assert.equal(result.skipped, 1);
  assert.equal(result.sent, 0);
  assert.equal(sendCallCount, 0, 'an already-sent user must never reach the push sender at all');
});

test('a simulated cron retry (same tick run twice) never double-sends a user', async () => {
  const { db, sends } = fakeDatabase({
    candidates: [occurrence()],
    users: [{ userId: 'u1', expoPushToken: 't1', locale: 'en' }],
  });
  await runDailyDigest({ dryRun: false, now: NOW }, db, okPushSender());
  assert.equal(sends.length, 1);
  // Simulate the retry: hasAlreadySent now reflects the row written above.
  const retryAlreadySent = new Set(sends.map((s) => s.sendKey));
  const { db: retryDb, sends: retrySends } = fakeDatabase({
    candidates: [occurrence()],
    users: [{ userId: 'u1', expoPushToken: 't1', locale: 'en' }],
    alreadySent: retryAlreadySent,
  });
  const retryResult = await runDailyDigest({ dryRun: false, now: NOW }, retryDb, okPushSender());
  assert.equal(retryResult.sent, 0);
  assert.equal(retryResult.skipped, 1);
  assert.equal(retrySends.length, 0);
});

test('an invalid push token fails that user without blocking other users\' sends', async () => {
  const { db, removedTokens } = fakeDatabase({
    candidates: [occurrence()],
    users: [
      { userId: 'bad', expoPushToken: 'stale-token', locale: 'en' },
      { userId: 'good', expoPushToken: 'fresh-token', locale: 'en' },
    ],
  });
  const pushSender: PushSender = {
    async send(messages) {
      return messages.map((m) => (m.to === 'stale-token' ? ({ status: 'invalid_token', message: 'DeviceNotRegistered' } as PushSendOutcome) : ({ status: 'ok' } as PushSendOutcome)));
    },
  };
  const result = await runDailyDigest({ dryRun: false, now: NOW }, db, pushSender);
  assert.equal(result.sent, 1);
  assert.equal(result.failed, 1);
  assert.deepEqual(removedTokens, ['stale-token']);
});

test('partial batch failure retains every pre-send claim and completes only successes', async () => {
  const { db, sends, completed, failedClaims } = fakeDatabase({
    candidates: [occurrence()],
    users: [
      { userId: 'u1', expoPushToken: 't1', locale: 'en' },
      { userId: 'u2', expoPushToken: 't2', locale: 'en' },
      { userId: 'u3', expoPushToken: 't3', locale: 'en' },
    ],
  });
  const pushSender: PushSender = {
    async send(messages) {
      return messages.map((_m, i) => (i === 1 ? ({ status: 'error', message: 'network timeout' } as PushSendOutcome) : ({ status: 'ok' } as PushSendOutcome)));
    },
  };
  const result = await runDailyDigest({ dryRun: false, now: NOW }, db, pushSender);
  assert.equal(result.sent, 2);
  assert.equal(result.failed, 1);
  assert.equal(sends.length, 3, 'every network call must have an idempotency claim first');
  assert.equal(completed.length, 2);
  assert.equal(failedClaims.length, 1);
});

test('missing tokens and duplicate device tokens are skipped without sending twice', async () => {
  const { db } = fakeDatabase({
    candidates: [occurrence()],
    users: [
      { userId: 'no-token', expoPushToken: null, locale: 'en' },
      { userId: 'first', expoPushToken: 'shared-token', locale: 'he' },
      { userId: 'second', expoPushToken: 'shared-token', locale: 'he' },
    ],
  });
  let messageCount = 0;
  const result = await runDailyDigest({ dryRun: false, now: NOW }, db, {
    async send(messages) { messageCount += messages.length; return messages.map(() => ({ status: 'ok' as const })); },
  });
  assert.equal(result.eligibleUsers, 3);
  assert.equal(result.validPushUsers, 1);
  assert.equal(result.skipped, 2);
  assert.equal(messageCount, 1);
});

test('a concurrent second invocation loses the atomic claim before any push call', async () => {
  const sharedSent = new Set<string>();
  const first = fakeDatabase({ candidates: [occurrence()], users: [{ userId: 'u1', expoPushToken: 't1', locale: 'en' }], alreadySent: sharedSent });
  const second = fakeDatabase({ candidates: [occurrence()], users: [{ userId: 'u1', expoPushToken: 't1', locale: 'en' }], alreadySent: sharedSent });
  let pushes = 0;
  const sender: PushSender = { async send(messages) { pushes += messages.length; return messages.map(() => ({ status: 'ok' as const })); } };
  await Promise.all([
    runDailyDigest({ dryRun: false, now: NOW }, first.db, sender),
    runDailyDigest({ dryRun: false, now: NOW }, second.db, sender),
  ]);
  assert.equal(pushes, 1);
});

test('analytics events use only safe, non-identifying properties', async () => {
  const { db, analytics } = fakeDatabase({
    candidates: [occurrence()],
    users: [{ userId: 'u1', expoPushToken: 't1', locale: 'he' }],
  });
  await runDailyDigest({ dryRun: false, now: NOW }, db, okPushSender());
  const forbidden = ['email', 'child', 'birthdate', 'token', 'coordinate', 'latitude', 'longitude'];
  for (const entry of analytics) {
    const serialized = JSON.stringify(entry.properties).toLowerCase();
    for (const word of forbidden) assert.doesNotMatch(serialized, new RegExp(word), `${entry.event} leaked "${word}"`);
  }
  assert.ok(analytics.some((a) => a.event === 'daily_push_sent'));
});

test('provider mix is reported per selected event provider', async () => {
  const { db } = fakeDatabase({
    candidates: [
      occurrence({ occurrenceId: 'a', provider: 'tel_aviv_digitel' }),
      occurrence({ occurrenceId: 'b', category: 'workshop', provider: 'cinematheque_tel_aviv' }),
    ],
    users: [],
  });
  const result = await runDailyDigest({ dryRun: false, now: NOW }, db, okPushSender());
  assert.deepEqual(result.providerMix, { tel_aviv_digitel: 1, cinematheque_tel_aviv: 1 });
});

test('Weekly uses the Sunday anchor, weekly preference path, and per-day cap', async () => {
  const sundayEvents = Array.from({ length: 5 }, (_, index) => occurrence({
    occurrenceId: `weekly-${index}`,
    eventId: `weekly-event-${index}`,
    startsAt: `2026-08-23T${String(10 + index).padStart(2, '0')}:00:00+03:00`,
    category: index % 2 ? 'workshop' : 'community',
  }));
  const fake = fakeDatabase({ candidates: sundayEvents, users: [{ userId: 'u1', expoPushToken: 't1', locale: 'he' }] });
  const result = await runWeeklyDigest({ dryRun: true, now: new Date('2026-08-22T16:05:00Z') }, fake.db, okPushSender());
  assert.equal(result.localDate, '2026-08-23');
  assert.equal(result.periodEnd, '2026-08-29');
  assert.equal(result.eventsSelected, 3);
  assert.deepEqual(fake.requestedDigestTypes, [DIGEST_TYPE_WEEKLY]);
  assert.equal(result.wouldSend, 1);
  assert.equal(result.socialOutput?.days.length, 7);
});

test('Daily and Weekly preferences remain independent in the shared delivery path', async () => {
  const daily = fakeDatabase({ candidates: [occurrence()], users: [] });
  const weekly = fakeDatabase({ candidates: [occurrence({ startsAt: '2026-08-23T10:00:00+03:00' })], users: [] });
  await runDailyDigest({ dryRun: true, now: NOW }, daily.db, okPushSender());
  await runWeeklyDigest({ dryRun: true, now: new Date('2026-08-22T16:05:00Z') }, weekly.db, okPushSender());
  assert.deepEqual(daily.requestedDigestTypes, [DIGEST_TYPE_DAILY]);
  assert.deepEqual(weekly.requestedDigestTypes, [DIGEST_TYPE_WEEKLY]);
});

test('Weekly cron retry cannot claim the same user and week twice', async () => {
  const alreadySent = new Set<string>();
  const weeklyOccurrence = occurrence({ startsAt: '2026-08-23T10:00:00+03:00' });
  const first = fakeDatabase({ candidates: [weeklyOccurrence], users: [{ userId: 'u1', expoPushToken: 't1', locale: 'en' }], alreadySent });
  await runWeeklyDigest({ dryRun: false, now: new Date('2026-08-22T16:05:00Z') }, first.db, okPushSender());
  const second = fakeDatabase({ candidates: [weeklyOccurrence], users: [{ userId: 'u1', expoPushToken: 't1', locale: 'en' }], alreadySent });
  const retry = await runWeeklyDigest({ dryRun: false, now: new Date('2026-08-22T16:10:00Z') }, second.db, okPushSender());
  assert.equal(retry.sent, 0);
  assert.equal(retry.skipped, 1);
  assert.equal(alreadySent.has(buildDigestSendKey('u1', DIGEST_TYPE_WEEKLY, '2026-08-23')), true);
});

test('Weekend uses Thursday anchor, separate preference path, and max three per section', async () => {
  const candidates = Array.from({ length: 5 }, (_, index) => occurrence({
    occurrenceId: `weekend-${index}`, eventId: `weekend-event-${index}`,
    startsAt: `2026-08-28T${String(10 + index).padStart(2, '0')}:00:00+03:00`,
    category: index % 2 ? 'workshop' : 'story_time',
  }));
  const fake = fakeDatabase({ candidates, users: [{ userId: 'u1', expoPushToken: 't1', locale: 'he' }] });
  const result = await runWeekendDigest({ dryRun: true, now: new Date('2026-08-27T15:05:00Z') }, fake.db, okPushSender());
  assert.equal(result.localDate, '2026-08-27');
  assert.equal(result.periodEnd, '2026-08-29');
  assert.equal(result.eventsSelected, 3);
  assert.deepEqual(fake.requestedDigestTypes, [DIGEST_TYPE_WEEKEND]);
  assert.equal(result.wouldSend, 1);
  assert.equal(result.socialOutput, null);
});

test('Daily, Weekly and Weekend preferences remain independent', async () => {
  const daily = fakeDatabase({ candidates: [occurrence()], users: [] });
  const weekly = fakeDatabase({ candidates: [occurrence({ startsAt: '2026-08-23T10:00:00+03:00' })], users: [] });
  const weekend = fakeDatabase({ candidates: [occurrence({ startsAt: '2026-08-28T10:00:00+03:00' })], users: [] });
  await runDailyDigest({ dryRun: true, now: NOW }, daily.db, okPushSender());
  await runWeeklyDigest({ dryRun: true, now: new Date('2026-08-22T16:05:00Z') }, weekly.db, okPushSender());
  await runWeekendDigest({ dryRun: true, now: new Date('2026-08-27T15:05:00Z') }, weekend.db, okPushSender());
  assert.deepEqual(daily.requestedDigestTypes, [DIGEST_TYPE_DAILY]);
  assert.deepEqual(weekly.requestedDigestTypes, [DIGEST_TYPE_WEEKLY]);
  assert.deepEqual(weekend.requestedDigestTypes, [DIGEST_TYPE_WEEKEND]);
});

test('Weekend concurrent/retry delivery remains atomically send-once', async () => {
  const alreadySent = new Set<string>();
  const candidate = occurrence({ startsAt: '2026-08-28T10:00:00+03:00' });
  const first = fakeDatabase({ candidates: [candidate], users: [{ userId: 'u1', expoPushToken: 't1', locale: 'en' }], alreadySent });
  await runWeekendDigest({ dryRun: false, now: new Date('2026-08-27T15:05:00Z') }, first.db, okPushSender());
  const retryDb = fakeDatabase({ candidates: [candidate], users: [{ userId: 'u1', expoPushToken: 't1', locale: 'en' }], alreadySent });
  const retry = await runWeekendDigest({ dryRun: false, now: new Date('2026-08-27T15:10:00Z') }, retryDb.db, okPushSender());
  assert.equal(retry.sent, 0);
  assert.equal(retry.skipped, 1);
  assert.equal(alreadySent.has(buildDigestSendKey('u1', DIGEST_TYPE_WEEKEND, '2026-08-27')), true);
});

test('Weekend analytics use the shared path once and remain privacy-safe', async () => {
  const fake = fakeDatabase({ candidates: [occurrence({ startsAt: '2026-08-28T10:00:00+03:00' })], users: [{ userId: 'u1', expoPushToken: 't1', locale: 'ar' }] });
  await runWeekendDigest({ dryRun: false, now: new Date('2026-08-27T15:05:00Z') }, fake.db, okPushSender());
  assert.equal(fake.analytics.filter((entry) => entry.event === 'weekend_digest_generated').length, 1);
  assert.equal(fake.analytics.filter((entry) => entry.event === 'weekend_push_sent').length, 1);
  assert.doesNotMatch(JSON.stringify(fake.analytics), /token|email|child|latitude|longitude/i);
});
