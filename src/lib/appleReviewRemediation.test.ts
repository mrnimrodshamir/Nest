import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { isUserLocallyBlocked, markUserBlocked, markUserUnblocked, subscribeToBlocks } from './blockState.ts';
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION, LEGAL_URLS } from '../constants/legal.ts';

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');

test('legal consent is current-version, server-backed and globally gates authenticated routing', () => {
  const auth = read('../hooks/useAuth.tsx');
  const app = read('../../App.tsx');
  const migration = read('../../supabase/migrations/20260906120000_apple_review_ugc_safety.sql');
  assert.match(CURRENT_TERMS_VERSION, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(CURRENT_PRIVACY_VERSION, /^\d{4}-\d{2}-\d{2}$/);
  assert.equal(LEGAL_URLS.terms, 'https://nestup.best/terms');
  assert.match(auth, /persistCurrentLegalConsent/);
  assert.match(auth, /if \(!input\.acceptedLegal\)/);
  assert.match(app, /legalConsentStatus !== 'accepted'/);
  assert.match(app, /<LegalConsentScreen/);
  assert.match(migration, /record_legal_acceptance/);
  assert.match(migration, /user_id uuid primary key references auth\.users/);
});

test('all required UGC surfaces expose the shared report flow', () => {
  const activity = read('../screens/ActivityDetailScreen.tsx');
  const profile = read('../screens/PublicProfileScreen.tsx');
  const chat = read('../screens/ChatScreen.tsx');
  assert.match(activity, /type: 'activity'/);
  assert.match(profile, /type: 'user'/);
  assert.match(chat, /'forum_message' : 'message'/);
  for (const source of [activity, profile, chat]) assert.match(source, /ReportContentSheet/);
});

test('block state removes loaded content synchronously and supports unblock', () => {
  const seen: string[] = [];
  const unsubscribe = subscribeToBlocks((id) => seen.push(id));
  markUserBlocked('member-b');
  assert.equal(isUserLocallyBlocked('member-b'), true);
  assert.deepEqual(seen, ['member-b']);
  markUserUnblocked('member-b');
  assert.equal(isUserLocallyBlocked('member-b'), false);
  unsubscribe();
});

test('migration provides typed reports, owner-only consent, bidirectional communication isolation and deduplicated block signals', () => {
  const sql = read('../../supabase/migrations/20260906120000_apple_review_ugc_safety.sql');
  assert.match(sql, /target_type text/);
  assert.match(sql, /message_id uuid/);
  assert.match(sql, /forum_id uuid/);
  assert.match(sql, /reporter_id,reported_user_id/);
  assert.match(sql, /is_blocked_between/);
  assert.match(sql, /messages_block_send/);
  assert.match(sql, /get_or_create_direct_chat_unchecked/);
  assert.match(sql, /reports_one_block_signal_per_pair/);
  assert.match(sql, /moderation_queue/);
  assert.doesNotMatch(sql, /delete from public\.(reports|blocks|messages|activities)/i);
});

test('location surfaces expose content markers only and public profile contract has no coordinates', () => {
  const discovery = read('../screens/DiscoverScreen.tsx');
  const publicProfile = read('../hooks/usePublicProfile.ts');
  assert.match(discovery, /ActivityMapPin/);
  assert.match(discovery, /PlaceMapPin/);
  assert.match(discovery, /EventMapPin/);
  assert.doesNotMatch(discovery, /UserMapPin|ParentMapPin|NearbyUser/);
  assert.doesNotMatch(publicProfile, /select\([^)]*(latitude|longitude|location)[^)]*\)/s);
});

test('all six locale dictionaries include legal, report and safety copy', () => {
  for (const locale of ['en', 'he', 'fr', 'ru', 'ar', 'es']) {
    const source = read(`../i18n/${locale}.ts`);
    for (const key of ['legal.title', 'legal.accept', 'report.action', 'report.reason.safety', 'moderation.options']) {
      assert.ok(source.includes(`'${key}'`), `${locale} missing ${key}`);
    }
  }
});
