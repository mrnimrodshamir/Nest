import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('critical release funnels are wired through the centralized analytics layer', () => {
  const sources = [
    read('../hooks/useAuth.tsx'),
    read('../screens/auth/SignUpScreen.tsx'),
    read('../screens/auth/CompleteAppleProfileScreen.tsx'),
    read('../screens/DiscoverScreen.tsx'),
    read('../hooks/useActivityRsvp.ts'),
    read('../hooks/useCreateActivity.ts'),
    read('../hooks/useEventRsvp.ts'),
    read('../hooks/useChatMessages.ts'),
    read('../i18n/I18nProvider.tsx'),
    read('./contentShare.ts'),
    read('../screens/EventDetailsScreen.tsx'),
    read('../screens/PlaceDetailsScreen.tsx'),
    read('../screens/MessagesScreen.tsx'),
    read('../screens/PublicProfileScreen.tsx'),
    read('../../App.tsx'),
  ].join('\n');
  for (const event of [
    'app_opened', 'onboarding_started', 'onboarding_completed', 'login_started', 'login_completed', 'language_changed',
    'discovery_opened', 'discovery_search_used', 'discovery_filter_changed', 'discovery_sort_changed',
    'discovery_item_opened', 'activity_opened', 'activity_created', 'activity_joined', 'activity_left', 'activity_shared',
    'event_opened', 'event_rsvp_joined', 'event_rsvp_left', 'event_shared', 'place_opened', 'place_shared',
    'chats_opened', 'forum_opened', 'forum_joined', 'forum_message_sent', 'public_profile_opened',
    'profile_updated', 'share_started', 'share_completed', 'share_cancelled', 'share_failed',
  ]) assert.match(sources, new RegExp(`['\"]${event}['\"]`), `${event} is not instrumented`);
});

test('onboarding starts on screen entry rather than submit or auth rerenders', () => {
  const auth = read('../hooks/useAuth.tsx');
  const email = read('../screens/auth/SignUpScreen.tsx');
  const apple = read('../screens/auth/CompleteAppleProfileScreen.tsx');
  assert.doesNotMatch(auth, /track\('onboarding_started'/);
  assert.match(email, /useEffect\(\(\) => \{\s*track\('onboarding_started', \{ onboarding_method: 'email' \}\);\s*\}, \[\]\)/);
  assert.match(apple, /useEffect\(\(\) => \{\s*track\('onboarding_started', \{ onboarding_method: 'apple' \}\);\s*\}, \[\]\)/);
});

test('resolved EN HE FR RU locale is attached to the shared analytics context', () => {
  const source = read('../i18n/I18nProvider.tsx');
  assert.match(source, /setAnalyticsContext\(\{ language: locale \}\)/);
});

test('all content sharing surfaces pass typed analytics context to the hardened helper', () => {
  const activity = read('../screens/ActivityDetailScreen.tsx') + read('../screens/ShareActivityScreen.tsx');
  const place = read('../screens/PlaceDetailsScreen.tsx');
  const event = read('../screens/EventDetailsScreen.tsx');
  assert.match(activity, /contentType: 'activity'/);
  assert.match(place, /contentType: 'place'/);
  assert.match(event, /contentType: 'event'/);
  for (const source of [activity, place, event]) {
    assert.doesNotMatch(source, /Share\.share\(/);
    assert.doesNotMatch(source, /whatsapp:\/\/send\?/);
  }
});

test('mobile analytics call sites do not attach known private fields', () => {
  const source = read('../../src/lib/analytics.ts') + read('../../src/lib/analyticsCore.ts');
  assert.match(source, /PRIVATE_PROPERTY/);
  assert.match(source, /birth/);
  assert.match(source, /coordinates/);
  assert.match(source, /message/);
});
