import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const app = readFileSync(new URL('../../App.tsx', import.meta.url), 'utf8');
const events = readFileSync(new URL('../lib/events.ts', import.meta.url), 'utf8');
const dailyScreen = readFileSync(new URL('../screens/DailyDigestScreen.tsx', import.meta.url), 'utf8');
const weeklyScreen = readFileSync(new URL('../screens/WeeklyDigestScreen.tsx', import.meta.url), 'utf8');
const handler = readFileSync(new URL('../../supabase/functions/send-daily-digest/handler.ts', import.meta.url), 'utf8');
const payload = readFileSync(new URL('../../supabase/functions/_shared/dailyDigest/pushPayload.ts', import.meta.url), 'utf8');

test('Build-44 push popups load the exact backend-persisted occurrence order', () => {
  assert.match(handler, /occurrenceIds: result\.selectedOccurrenceIds/);
  assert.match(payload, /occurrence_ids: \[\.\.\.\(input\.occurrenceIds \?\? \[\]\)\]/);
  assert.match(app, /occurrenceIds: pending\.occurrenceIds/);
  assert.match(events, /queryPersistedDigestEvents/);
  assert.match(events, /\.in\('occurrence_id', uniqueIds\)/);
  assert.match(events, /rowsInDigestOrder\(data/);
});

test('opening Event Details keeps the Digest underneath; only X records close and resets home', () => {
  for (const screen of [dailyScreen, weeklyScreen]) {
    assert.match(screen, /handleOpenEvent[\s\S]*onOpenEvent\(event\.occurrence\.id\)/);
    assert.match(screen, /handleClose[\s\S]*digest_closed/);
    assert.doesNotMatch(screen, /handleOpenEvent[\s\S]{0,500}handleClose\(/);
  }
  assert.match(app, /onOpenEvent=\{\(occurrenceId\) => navigation\.navigate\('EventDetails'/);
  assert.match(app, /navigation\.reset\(\{ index: 0, routes: \[\{ name: 'Tabs' \}\] \}\)/);
});

test('viewed analytics are guarded against rerenders and RTL text uses native direction', () => {
  for (const screen of [dailyScreen, weeklyScreen]) {
    assert.match(screen, /viewedKeyRef/);
    assert.match(screen, /isRTL && styles\.rtlText/);
    assert.doesNotMatch(screen, /rtlHeader|flexDirection: 'row-reverse'/, 'native RTL already mirrors row flow');
  }
  assert.equal((dailyScreen.match(/track\('daily_digest_viewed'/g) ?? []).length, 1);
  assert.equal((weeklyScreen.match(/track\('weekly_digest_viewed'/g) ?? []).length, 1);
});
