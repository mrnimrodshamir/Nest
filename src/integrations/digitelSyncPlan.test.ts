import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  MISSING_GRACE_DAYS,
  RETENTION_DAYS,
  buildSyncPlan,
  type ExistingOccurrence,
} from '../../supabase/functions/_shared/digitel/syncPlan.ts';
import { assessFamilyRelevance } from '../../supabase/functions/_shared/digitel/relevance.ts';
import type { DigitelEventCandidate } from '../../supabase/functions/_shared/digitel/connector.ts';

const NOW = new Date('2026-08-12T09:00:00Z');
const day = 86_400_000;

function candidate(over: Partial<DigitelEventCandidate> = {}): DigitelEventCandidate {
  return {
    provider: 'tel_aviv_digitel',
    providerEventId: 'evt-1',
    providerTransportId: '1001',
    sourceGroupId: null,
    title: 'שעת סיפור לפעוטות',
    description: 'סיפור ויצירה במוזיאון',
    sourceType: null,
    sourceUrl: null,
    startTime: new Date(NOW.getTime() + 3 * day).toISOString(),
    endTime: null, recurring: null, ageMinMonths: null, ageMaxMonths: null, category: null,
    locationName: 'ספריית בית אריאלה',
    latitude: 32.07, longitude: 34.78,
    price: null, registrationRequired: null, registrationUrl: null,
    imageUrl: null, iconUrl: null, cancellationStatus: null,
    sourcePublishedAt: null, sourceUpdatedAt: null,
    occurrenceFingerprint: 'fp-1',
    occurrenceIdentityKey: 'ik-1',
    ...over,
  } as DigitelEventCandidate;
}

function existing(over: Partial<ExistingOccurrence> = {}): ExistingOccurrence {
  return {
    occurrenceId: 'occ-1', eventId: 'ev-1', occurrenceFingerprint: 'fp-1',
    startsAt: new Date(NOW.getTime() + 3 * day).toISOString(), endsAt: null,
    provider: 'tel_aviv_digitel', missingSince: null, archivedAt: null, hasAttendees: false,
    ...over,
  };
}

const complete = { sourceComplete: true, now: NOW } as const;

// ===========================================================================
// IDEMPOTENCY
// ===========================================================================

test('the same payload twice creates nothing the second time', () => {
  const first = buildSyncPlan({ candidates: [candidate()], existing: [], ...complete });
  assert.equal(first.inserts.length, 1);

  const second = buildSyncPlan({ candidates: [candidate()], existing: [existing()], ...complete });
  assert.equal(second.inserts.length, 0, 'a repeated sync inserted a duplicate');
  assert.equal(second.unchanged.length, 1);
  assert.deepEqual(second.seen, ['occ-1']);
});

test('a hundred repeated syncs still resolve to one occurrence', () => {
  const rows = [existing()];
  for (let run = 0; run < 100; run += 1) {
    const plan = buildSyncPlan({ candidates: [candidate()], existing: rows, ...complete });
    assert.equal(plan.inserts.length, 0, `run ${run} inserted`);
    assert.equal(plan.hardDelete.length, 0, `run ${run} deleted`);
  }
});

test('a changed provider record updates rather than duplicating', () => {
  const changed = candidate({
    sourceUpdatedAt: NOW.toISOString(),
    startTime: new Date(NOW.getTime() + 4 * day).toISOString(),
  });
  const plan = buildSyncPlan({ candidates: [changed], existing: [existing()], ...complete });
  assert.equal(plan.inserts.length, 0);
  assert.equal(plan.updates.length, 1);
});

// ===========================================================================
// THE SOURCE-COMPLETE BOUNDARY — the rule that protects the catalogue
// ===========================================================================

test('an INCOMPLETE fetch decides nothing destructive', () => {
  // The provider returned nothing at all — a timeout, or a failed first page.
  const plan = buildSyncPlan({
    candidates: [],
    existing: [existing(), existing({ occurrenceId: 'occ-2', occurrenceFingerprint: 'fp-2' })],
    sourceComplete: false,
    now: NOW,
  });
  assert.deepEqual(plan.newlyMissing, [], 'partial fetch marked records missing');
  assert.deepEqual(plan.archive, []);
  assert.deepEqual(plan.hardDelete, []);
  assert.deepEqual(plan.preserveForUserData, []);
});

test('a partial pagination run cannot trigger cleanup of long-finished records', () => {
  const ancient = existing({
    occurrenceId: 'occ-old',
    occurrenceFingerprint: 'fp-old',
    startsAt: new Date(NOW.getTime() - 200 * day).toISOString(),
  });
  const plan = buildSyncPlan({ candidates: [], existing: [ancient], sourceComplete: false, now: NOW });
  assert.deepEqual(plan.hardDelete, [], 'incomplete run deleted an expired record');
});

test('a malformed response that yields zero candidates still deletes nothing when incomplete', () => {
  const plan = buildSyncPlan({ candidates: [], existing: [existing()], sourceComplete: false, now: NOW });
  assert.deepEqual([...plan.newlyMissing, ...plan.archive, ...plan.hardDelete], []);
});

// ===========================================================================
// MISSING / STALE
// ===========================================================================

test('a FUTURE occurrence absent from a complete response is marked, not deleted', () => {
  const plan = buildSyncPlan({ candidates: [], existing: [existing()], ...complete });
  assert.deepEqual(plan.newlyMissing, ['occ-1']);
  assert.deepEqual(plan.archive, []);
  assert.deepEqual(plan.hardDelete, []);
});

test('a returning occurrence recovers and is not archived', () => {
  const wasMissing = existing({ missingSince: new Date(NOW.getTime() - 10 * day).toISOString() });
  const plan = buildSyncPlan({ candidates: [candidate()], existing: [wasMissing], ...complete });
  assert.deepEqual(plan.seen, ['occ-1'], 'a returning record must be marked seen so missing state clears');
  assert.deepEqual(plan.archive, []);
});

test('still missing after the grace period is archived, never hard-deleted', () => {
  const stale = existing({
    missingSince: new Date(NOW.getTime() - (MISSING_GRACE_DAYS + 1) * day).toISOString(),
  });
  const plan = buildSyncPlan({ candidates: [], existing: [stale], ...complete });
  assert.deepEqual(plan.archive, ['occ-1']);
  assert.deepEqual(plan.hardDelete, [], 'a withdrawn future event must never be hard-deleted');
});

test('a FINISHED occurrence dropping out of the feed is expiry, not withdrawal', () => {
  // Providers only publish a rolling window. Yesterday's event vanishing is
  // normal and must not be recorded as the city withdrawing it.
  const finished = existing({ startsAt: new Date(NOW.getTime() - 2 * day).toISOString() });
  const plan = buildSyncPlan({ candidates: [], existing: [finished], ...complete });
  assert.deepEqual(plan.newlyMissing, [], 'a finished event was misreported as missing');
});

// ===========================================================================
// RETENTION
// ===========================================================================

test('a finished occurrence inside the retention window is retained', () => {
  const recent = existing({ startsAt: new Date(NOW.getTime() - (RETENTION_DAYS - 1) * day).toISOString() });
  const plan = buildSyncPlan({ candidates: [], existing: [recent], ...complete });
  assert.deepEqual(plan.hardDelete, []);
  assert.deepEqual(plan.archive, []);
});

test('a finished occurrence past retention becomes a cleanup candidate', () => {
  const old = existing({ startsAt: new Date(NOW.getTime() - (RETENTION_DAYS + 1) * day).toISOString() });
  const plan = buildSyncPlan({ candidates: [], existing: [old], ...complete });
  assert.deepEqual(plan.hardDelete, ['occ-1']);
});

test('retention is measured from the END time when the provider supplies one', () => {
  const longRunning = existing({
    startsAt: new Date(NOW.getTime() - (RETENTION_DAYS + 5) * day).toISOString(),
    endsAt: new Date(NOW.getTime() - 1 * day).toISOString(),
  });
  const plan = buildSyncPlan({ candidates: [], existing: [longRunning], ...complete });
  assert.deepEqual(plan.hardDelete, [], 'a festival that ended yesterday was deleted on its start date');
});

// ===========================================================================
// USER DATA WINS
// ===========================================================================

test('RSVP-linked occurrences are archived instead of deleted, however old', () => {
  const old = existing({
    startsAt: new Date(NOW.getTime() - (RETENTION_DAYS + 100) * day).toISOString(),
    hasAttendees: true,
  });
  const plan = buildSyncPlan({ candidates: [], existing: [old], ...complete });
  assert.deepEqual(plan.hardDelete, [], 'user attendance history would have been destroyed');
  assert.deepEqual(plan.preserveForUserData, ['occ-1']);
});

test('cleanup is scoped to the provider and never touches other content', () => {
  const foreign = existing({
    occurrenceId: 'occ-other', occurrenceFingerprint: 'fp-other', provider: 'some_other_provider',
    startsAt: new Date(NOW.getTime() - 500 * day).toISOString(),
  });
  const plan = buildSyncPlan({ candidates: [], existing: [foreign], ...complete });
  assert.deepEqual(plan.hardDelete, [], 'cleanup reached another provider');
  assert.deepEqual(plan.archive, []);
  assert.deepEqual(plan.newlyMissing, []);
});

test('an already-archived occurrence is left alone', () => {
  const archived = existing({
    archivedAt: NOW.toISOString(),
    startsAt: new Date(NOW.getTime() - 400 * day).toISOString(),
  });
  const plan = buildSyncPlan({ candidates: [], existing: [archived], ...complete });
  assert.deepEqual([...plan.hardDelete, ...plan.archive, ...plan.newlyMissing], []);
});

// ===========================================================================
// RELEVANCE
// ===========================================================================

test('family-relevant municipal events are accepted', () => {
  for (const title of [
    'שעת סיפור לפעוטות', 'סדנת יצירה למשפחות', 'הצגת ילדים בפארק',
    'Story time for toddlers', 'Family workshop at the museum',
  ]) {
    assert.equal(assessFamilyRelevance({ title }).relevant, true, title);
  }
});

test('clearly irrelevant municipal records are rejected', () => {
  for (const title of [
    'מכרז פומבי לאספקת שירותים', 'ישיבת מועצת העיר', 'הודעה על חסימת כביש',
    'Council meeting agenda', 'Public tender',
  ]) {
    assert.equal(assessFamilyRelevance({ title }).relevant, false, title);
  }
});

test('an exclusion beats an inclusion in the same record', () => {
  // "A wine workshop for parents" matches both. It is not a family outing.
  const decision = assessFamilyRelevance({ title: 'סדנת יין להורים' });
  assert.equal(decision.relevant, false);
  assert.equal(decision.relevant === false && decision.reason, 'excluded_term');
});

test('a record with no family signal at all is rejected, not defaulted in', () => {
  const decision = assessFamilyRelevance({ title: 'עדכון תעריפי חניה' });
  assert.equal(decision.relevant, false);
});

test('irrelevant candidates never reach the insert set', () => {
  const plan = buildSyncPlan({
    candidates: [candidate({ title: 'ישיבת מועצת העיר', description: null, locationName: null })],
    existing: [], ...complete,
  });
  assert.equal(plan.inserts.length, 0);
  assert.equal(plan.excluded.length, 1);
});
