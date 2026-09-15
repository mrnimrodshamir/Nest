import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { isUserLocallyBlocked, markUserBlocked, markUserUnblocked, subscribeToBlocks, subscribeToBlockStateChanges } from './blockState.ts';
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION, LEGAL_URLS } from '../constants/legal.ts';

const read = (relative: string) => readFileSync(new URL(relative, import.meta.url), 'utf8');

test('terms precede every signed-out route without bypassing server-recorded consent', () => {
  const navigation = read('../navigation/AuthNavigator.tsx');
  const consent = read('../screens/auth/LegalConsentScreen.tsx');
  const app = read('../../App.tsx');
  const gate = navigation.indexOf('if (!reviewedTermsBeforeAuth)');
  assert.ok(gate > 0 && gate < navigation.indexOf('<Stack.Navigator'));
  assert.match(navigation, /\[reviewedTermsBeforeAuth, setReviewedTermsBeforeAuth\] = useState\(false\)/);
  assert.match(navigation, /<LegalConsentScreen onContinueBeforeAuth=/);
  assert.match(consent, /if \(!checked \|\| saving\) return/);
  assert.match(consent, /if \(onContinueBeforeAuth\) \{\s+onContinueBeforeAuth\(\);\s+return;/);
  assert.match(consent, /disabled=\{!checked \|\| saving\}/);
  assert.match(consent, /Linking.openURL\(LEGAL_URLS.terms\)/);
  assert.match(consent, /Linking.openURL\(LEGAL_URLS.privacy\)/);
  assert.match(consent, /!onContinueBeforeAuth && <Pressable/);
  assert.match(app, /legalConsentStatus !== 'accepted'/);
  assert.match(consent, /await acceptLegalTerms\(\)/);
});

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
  const changes: Array<[string, boolean]> = [];
  const unsubscribe = subscribeToBlocks((id) => seen.push(id));
  const unsubscribeChanges = subscribeToBlockStateChanges((id, blocked) => changes.push([id, blocked]));
  markUserBlocked('member-b');
  assert.equal(isUserLocallyBlocked('member-b'), true);
  assert.deepEqual(seen, ['member-b']);
  markUserUnblocked('member-b');
  assert.equal(isUserLocallyBlocked('member-b'), false);
  assert.deepEqual(changes, [['member-b', true], ['member-b', false]]);
  unsubscribe();
  unsubscribeChanges();
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

test('migration fails closed on the audited production schema contract before changing anything', () => {
  const sql = read('../../supabase/migrations/20260906120000_apple_review_ugc_safety.sql');
  const preflightEnd = sql.indexOf('end $$;');
  const firstMutation = sql.indexOf('create table if not exists public.legal_acceptances');
  assert.ok(preflightEnd > 0 && preflightEnd < firstMutation, 'preflight must finish before the first mutation');
  for (const table of [
    'reports', 'blocks', 'messages', 'chat_participants', 'activities',
    'activity_attendees', 'event_attendees',
  ]) {
    assert.match(sql.slice(0, firstMutation), new RegExp(`'${table}'`));
  }
  for (const status of ['open', 'reviewed', 'dismissed', 'actioned']) {
    assert.match(sql.slice(0, firstMutation), new RegExp(`'${status}'`));
  }
  assert.match(sql.slice(0, firstMutation), /unique blocks\(blocker_id, blocked_id\)/);
  assert.match(sql.slice(0, firstMutation), /get_or_create_direct_chat\(uuid\).*returns uuid/s);
  assert.match(sql.slice(0, firstMutation), /get_activity_attendance\(uuid\) return contract/);
  assert.match(sql.slice(0, firstMutation), /prosecdef/);
});

test('chat-message reports derive the reporter from auth and require actual chat participation', () => {
  const sql = read('../../supabase/migrations/20260906120000_apple_review_ugc_safety.sql');
  const reportFunction = sql.slice(
    sql.indexOf('create or replace function public.submit_content_report'),
    sql.indexOf('revoke all on function public.submit_content_report'),
  );
  assert.match(reportFunction, /if auth\.uid\(\) is null then raise exception 'authentication required'/);
  assert.match(reportFunction, /from public\.chat_participants cp/);
  assert.match(reportFunction, /cp\.chat_id=m\.chat_id/);
  assert.match(reportFunction, /cp\.user_id=auth\.uid\(\)/);
  assert.match(reportFunction, /values\(auth\.uid\(\),reported/);
  assert.doesNotMatch(reportFunction, /p_reporter|can_access_chat/);
  assert.match(reportFunction, /if fid is null then raise exception 'invalid report target'/);
});

test('attendance replacement preserves the exact return contract and both live attendance states', () => {
  const sql = read('../../supabase/migrations/20260906120000_apple_review_ugc_safety.sql');
  const attendance = sql.slice(
    sql.indexOf('create or replace function public.get_activity_attendance'),
    sql.indexOf('revoke all on function public.get_activity_attendance'),
  );
  assert.match(attendance, /returns table\(source text,user_id uuid,display_name text,avatar_url text,coming_alone boolean,child_id uuid,child_name text,child_age_months integer\)/);
  assert.match(attendance, /aa\.status in \('going','attended'\)/);
  assert.match(attendance, /not public\.is_blocked_between\(auth\.uid\(\),aa\.user_id\)/);
  assert.match(attendance, /not public\.is_blocked_between\(auth\.uid\(\),a\.host_id\)/);
  assert.match(sql, /revoke all on function public\.get_activity_attendance\(uuid\) from public, anon/);
  assert.match(sql, /grant execute on function public\.get_activity_attendance\(uuid\) to authenticated/);
});

test('block enforcement is bidirectional, compositional and does not spam moderation', () => {
  const sql = read('../../supabase/migrations/20260906120000_apple_review_ugc_safety.sql');
  assert.match(sql, /\(x\.blocker_id=a and x\.blocked_id=b\) or \(x\.blocker_id=b and x\.blocked_id=a\)/);
  for (const policy of [
    'activities_block_isolation', 'activity_attendees_block_isolation',
    'event_attendees_block_isolation', 'messages_block_isolation', 'messages_block_send',
  ]) assert.match(sql, new RegExp(policy));
  assert.match(sql, /create policy messages_block_send[\s\S]*public\.chat_participants cp/);
  assert.match(sql, /get_or_create_direct_chat[\s\S]*is_blocked_between/);
  assert.match(sql, /reports_one_block_signal_per_pair/);
  assert.match(sql, /on conflict \(reporter_id,reported_user_id\) where target_type='block' do nothing/);
  assert.match(sql, /on conflict \(report_id\) do nothing/);
  assert.doesNotMatch(sql, /drop policy if exists messages_insert_participant/);

  const publicProfile = read('../hooks/usePublicProfile.ts');
  const nearby = read('../hooks/useNearbyActivities.ts');
  const chats = read('../hooks/useChatMessages.ts');
  const conversations = read('../hooks/useConversations.ts');
  assert.match(publicProfile, /rpc\('is_blocked_between'/);
  assert.match(nearby, /subscribeToBlocks/);
  assert.match(chats, /isUserLocallyBlocked/);
  assert.match(conversations, /isUserLocallyBlocked/);
  assert.match(conversations, /from\('blocks'\)/);
  assert.match(conversations, /rpc\('is_blocked_between'/);
  assert.match(conversations, /resolveUnavailableDirectChatIds/);
  assert.match(conversations, /setConversations\(\[\]\)/);
  assert.match(conversations, /subscribeToBlockStateChanges/);
});

test('all Apple report surfaces use typed targets without a client-supplied reporter identity', () => {
  const activity = read('../screens/ActivityDetailScreen.tsx');
  const profile = read('../screens/PublicProfileScreen.tsx');
  const chat = read('../screens/ChatScreen.tsx');
  const hook = read('../hooks/useReportAndBlock.ts');
  assert.match(activity, /type: 'activity'/);
  assert.match(profile, /type: 'user'/);
  assert.match(chat, /'forum_message' : 'message'/);
  assert.match(hook, /submit_content_report/);
  assert.doesNotMatch(hook, /reporter_id|p_reporter/);
});

test('migration extends reports and preserves existing report and block identities', () => {
  const sql = read('../../supabase/migrations/20260906120000_apple_review_ugc_safety.sql');
  assert.match(sql, /alter table public\.reports add column if not exists target_type/);
  assert.match(sql, /update public\.reports set target_type/);
  assert.doesNotMatch(sql, /create table(?: if not exists)? public\.reports/i);
  assert.doesNotMatch(sql, /create table(?: if not exists)? public\.blocks/i);
  assert.doesNotMatch(sql, /drop table|truncate table|delete from public\.(reports|blocks)/i);
  assert.doesNotMatch(sql, /update public\.(reports|blocks) set id/i);
  assert.match(sql, /insert into public\.blocks\(blocker_id,blocked_id\)[\s\S]*on conflict do nothing/);
});

test('location surfaces expose content markers only and public profile contract has no coordinates', () => {
  const discovery = read('../screens/DiscoverScreen.tsx');
  const publicProfile = read('../hooks/usePublicProfile.ts');
  assert.match(discovery, /ActivityMapPin/);
  assert.match(discovery, /PlaceMapPin/);
  assert.match(discovery, /EventMapPin/);
  assert.match(discovery, /showsUserLocation/);
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
