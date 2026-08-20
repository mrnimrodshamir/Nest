import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { View, ActivityIndicator, Pressable, Text, I18nManager, Linking } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  NavigationContainer,
  LinkingOptions,
  createNavigationContainerRef,
  useFocusEffect,
} from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Compass, ChatCircleDots, UserCircle } from 'phosphor-react-native';
import { useFonts } from '@expo-google-fonts/plus-jakarta-sans/useFonts';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import '@/lib/contentShareNative';

import { DiscoverScreen } from '@/screens/DiscoverScreen';
import { ActivityDetailScreen } from '@/screens/ActivityDetailScreen';
import { CreateActivityScreen } from '@/screens/CreateActivityScreen';
import { PlaceDetailsScreen } from '@/screens/PlaceDetailsScreen';
import { EventDetailsScreen } from '@/screens/EventDetailsScreen';
import { ShareActivityScreen } from '@/screens/ShareActivityScreen';
import { ChatScreen } from '@/screens/ChatScreen';
import { EditActivityScreen } from '@/screens/EditActivityScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { EditProfileScreen } from '@/screens/EditProfileScreen';
import { MyActivitiesScreen } from '@/screens/MyActivitiesScreen';
import { DailyDigestScreen } from '@/screens/DailyDigestScreen';
import { MessagesScreen } from '@/screens/MessagesScreen';
import { BlockedUsersScreen } from '@/screens/BlockedUsersScreen';
import { PublicProfileScreen } from '@/screens/PublicProfileScreen';
import { LaunchScreen } from '@/screens/LaunchScreen';
import { CompleteAppleProfileScreen } from '@/screens/auth/CompleteAppleProfileScreen';
import { ResetPasswordScreen } from '@/screens/auth/ResetPasswordScreen';
import { AuthNavigator } from '@/navigation/AuthNavigator';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { spacing, theme } from '@/theme';
import { useAuth, AuthProvider } from '@/hooks/useAuth';
import { I18nProvider, useI18n } from '@/i18n';
import { openForum } from '@/hooks/useForums';
import { isForumKey, type ForumKey } from '@/constants/forums';
import { computeRouteDecision } from '@/lib/routing';
import { useActivityDetail } from '@/hooks/useActivityDetail';
import { useActivityRsvp } from '@/hooks/useActivityRsvp';
import { useActivityChatId } from '@/hooks/useActivityChatId';
import { useDirectChatId } from '@/hooks/useDirectChatId';
import { useHasUnread } from '@/hooks/useHasUnread';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { useEventDetails } from '@/hooks/useEventDetails';
import { supabase } from '@/lib/supabase';
import { setActiveChat } from '@/lib/activeChatTracker';
import { track } from '@/lib/analytics';
import { FALLBACK_LOCATION } from '@/constants/location';
import { MOCK_ACTIVITIES, MOCK_ACTIVITIES_EMPTY } from '@/mocks/mockActivities';
import { MOCK_FAMILY_FRIENDLY_PLACES } from '@/mocks/mockFamilyFriendlyPlaces';
import { MOCK_EVENTS } from '@/mocks/mockEvents';
import type { Activity } from '@/types/activity';
import type { Conversation } from '@/hooks/useConversations';
import type { CreateActivityInput } from '@/hooks/useCreateActivity';
import type { ShareableActivity } from '@/utils/buildShareMessage';
import { buildCreateAgainSeed } from '@/utils/createAgain';
import type { ActivityFormSeedValues } from '@/components/ActivityForm';
import type { FamilyFriendlyPlace } from '@/types/familyFriendlyPlace';
import type { EventDetails } from '@/types/event';
import { buildActivitySeedFromPlace } from '@/utils/placeActivityPrefill';
import { parseSharedContentUrl, type SharedContentRoute } from '@/utils/contentSharing';
import { parseDailyDigestNotification } from '@/utils/dailyDigestNotification';

// RTL is controlled by the selected app language in I18nProvider. Enable it
// before the first React tree mounts so a Hebrew relaunch can use native RTL
// layout. Keep physical left/right properties physical: intentional geometry
// such as maps, image crops and crash-contained marker hit areas must not be
// mirrored by React Native behind the component's back.
I18nManager.allowRTL(true);
I18nManager.swapLeftAndRightInRTL(false);

/** UI-preview escape hatch: renders the real production screens/components
 *  with mock data, skipping login and every backend call. Set only via
 *  EXPO_PUBLIC_PREVIEW_MODE=true (a separate env, never in .env used for
 *  real dev/preview/production builds) — must never be true in a build a
 *  real user could install. */
const PREVIEW_MODE = process.env.EXPO_PUBLIC_PREVIEW_MODE === 'true';

export type TabParamList = {
  Discovery: undefined;
  Chats: undefined;
  Profile: undefined;
};

export type RootStackParamList = {
  Tabs: undefined;
  ActivityDetail: { activityId: string };
  EditActivity: { activityId: string };
  CreateActivity: { mode: 'again' | 'place'; initialValues: ActivityFormSeedValues } | undefined;
  PlaceDetails: { placeId: string };
  EventDetails: { occurrenceId: string };
  ShareActivity: { activity: ShareableActivity };
  // `forumKey` is the stable slug from the forum catalogue, not a chat id —
  // the id is resolved (and the user silently joined) on open.
  Chat: { kind: 'group' | 'direct' | 'forum'; activityId?: string; otherUserId?: string; forumKey?: ForumKey; title?: string };
  PublicProfile: { userId: string };
  EditProfile: undefined;
  MyActivities: undefined;
  BlockedUsers: undefined;
  DailyDigest: { date?: string } | undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['nestup://', 'momzi://'],
  config: {
    screens: {
      Tabs: {
        screens: {
          Discovery: '',
          Chats: 'chats',
          Profile: 'profile',
        },
      },
      ActivityDetail: 'activity/:activityId',
      PlaceDetails: 'place/:placeId',
      EventDetails: 'event/:occurrenceId',
      EditActivity: 'activity/:activityId/edit',
      CreateActivity: 'create',
      ShareActivity: 'share',
      PublicProfile: 'member/:userId',
      Chat: {
        path: 'activity/:activityId/chat',
        parse: { kind: () => 'group' as const },
      },
      DailyDigest: 'daily-digest',
    },
  },
};

export default function App() {
  // I18nProvider sits ABOVE AuthProvider: auth screens are user-facing too, so
  // they need translations before a session exists.
  return (
    <I18nProvider>
      <AuthProvider>
        <AppInner />
      </AuthProvider>
    </I18nProvider>
  );
}

/** Everything that used to be in App() — split out only so AuthProvider
 *  can wrap it. useAuth() (and every other useAuth() call anywhere in the
 *  tree — AuthNavigator, ActivityDetailScreen, EditProfileScreen,
 *  ProfileScreen, every auth screen) now reads from the single shared
 *  provider above instead of each creating its own independent session/
 *  profile state and its own supabase.auth.onAuthStateChange
 *  subscription. See useAuth.tsx's AuthProvider doc comment for why that
 *  duplication was a real bug, not just wasteful. */
function AppInner() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });
  const { session, profile, isLoading: authLoading, isPasswordRecovery, beginPasswordRecovery } = useAuth();
  const { locale: appLocale } = useI18n();
  const pendingSharedRoute = useRef<SharedContentRoute | null>(null);
  const pendingDailyDigestRoute = useRef<{ kind: 'digest'; date: string } | { kind: 'fallback' } | null>(null);
  const lastHandledNotificationId = useRef<string | null>(null);
  // Distinguishes "no recovery link involved" (null) from a link that was
  // tapped but rejected before any session could be established — the latter
  // still needs its own screen (ResetPasswordScreen's invalid-link state),
  // not silent fallthrough to normal routing.
  const [recoveryLinkStatus, setRecoveryLinkStatus] = React.useState<'expired' | 'malformed' | null>(null);

  const navigatePendingSharedRoute = useCallback(() => {
    if (!session || !profile?.onboardingCompleted || !navigationRef.isReady() || !pendingSharedRoute.current) return;
    const route = pendingSharedRoute.current;
    pendingSharedRoute.current = null;
    if (route.screen === 'ActivityDetail') navigationRef.navigate('ActivityDetail', route.params);
    else if (route.screen === 'PlaceDetails') navigationRef.navigate('PlaceDetails', route.params);
    else if (route.screen === 'Chat') {
      // Unknown forum keys are dropped rather than opening an empty chat —
      // a link may come from a newer build than this one.
      if (isForumKey(route.params.forumKey)) {
        navigationRef.navigate('Chat', { kind: 'forum', forumKey: route.params.forumKey });
      }
    } else navigationRef.navigate('EventDetails', route.params);
  }, [session, profile?.onboardingCompleted]);

  const navigatePendingDailyDigest = useCallback(() => {
    if (!session || !profile?.onboardingCompleted || !navigationRef.isReady() || !pendingDailyDigestRoute.current) return;
    const pending = pendingDailyDigestRoute.current;
    try {
      if (pending.kind === 'fallback') {
        navigationRef.navigate('Tabs');
      } else if (navigationRef.getCurrentRoute()?.name !== 'DailyDigest') {
        navigationRef.navigate('DailyDigest', { date: pending.date });
        track('daily_push_opened', { date: pending.date, city: 'tel_aviv', locale: appLocale });
      }
      pendingDailyDigestRoute.current = null;
    } catch {
      // The main navigator may still be replacing the auth/onboarding tree.
      // Keep the pending route; the session/profile effect retries it.
    }
  }, [appLocale, profile?.onboardingCompleted, session]);

  // Password recovery deep links are handled here rather than through
  // NavigationContainer's `linking` prop below, because that prop is only
  // wired up once routeDecision === 'main-navigator' — i.e. only once the
  // user is ALREADY signed in. A recovery link is tapped precisely because
  // the user is signed out, so it needs to work regardless of session state.
  const handleIncomingUrl = useCallback((url: string | null) => {
    if (!url) return;
    if (url.includes('reset-password')) {
      void beginPasswordRecovery(url).then((status) => {
        if (status === 'expired' || status === 'malformed') setRecoveryLinkStatus(status);
      });
      return;
    }
    if (!session) pendingSharedRoute.current = parseSharedContentUrl(url);
  }, [session, beginPasswordRecovery]);

  useEffect(() => {
    void Linking.getInitialURL().then(handleIncomingUrl);
    const subscription = Linking.addEventListener('url', ({ url }) => handleIncomingUrl(url));
    return () => subscription.remove();
  }, [handleIncomingUrl]);

  useEffect(() => {
    navigatePendingSharedRoute();
  }, [navigatePendingSharedRoute]);

  useEffect(() => {
    navigatePendingDailyDigest();
  }, [navigatePendingDailyDigest]);

  // The Daily Digest push is composed server-side and has no client to ask
  // "what language is this user in" — this is the one sync point that makes
  // that possible. Fire-and-forget: a failed write just means the next
  // digest falls back to English for this user, not a crash or a stuck UI.
  useEffect(() => {
    if (!session) return;
    void supabase
      .from('profiles')
      .update({ locale: appLocale, locale_updated_at: new Date().toISOString() })
      .eq('id', session.user.id)
      .then(({ error }) => {
        if (error) console.log('[Locale] Server-side locale sync failed', error.message);
      });
  }, [session, appLocale]);

  useEffect(() => {
    // Safe fallback if the tapped notification references content that no
    // longer exists — try/catch around navigation, since a bad or stale
    // activityId shouldn't crash the app.
    function handleNotificationData(data: Record<string, unknown> | undefined, notificationId?: string) {
      if (notificationId && lastHandledNotificationId.current === notificationId) return;
      if (notificationId) lastHandledNotificationId.current = notificationId;

      // Capture Daily Digest taps even while auth/session restoration is still
      // replacing the navigator. Navigation happens later, once the main tree
      // is ready; malformed/stale payloads deterministically fall back home.
      const digestRoute = parseDailyDigestNotification(data);
      if (digestRoute.status !== 'not_digest') {
        pendingDailyDigestRoute.current = digestRoute.status === 'valid'
          ? { kind: 'digest', date: digestRoute.date }
          : { kind: 'fallback' };
        navigatePendingDailyDigest();
        return;
      }

      if (!navigationRef.isReady()) return;
      const activityId = data?.activityId as string | undefined;
      const otherUserId = data?.otherUserId as string | undefined;
      // A direct-message notification carries otherUserId, not activityId --
      // checking activityId alone here silently dropped every tap on a DM
      // push notification.
      if (data?.kind === 'direct_message' && otherUserId) {
        try {
          navigationRef.navigate('Chat', { kind: 'direct', otherUserId });
        } catch {
          // Content no longer reachable — stay put rather than crash.
        }
        return;
      }
      if (!activityId) return;
      try {
        if (data?.kind === 'chat') {
          navigationRef.navigate('Chat', {
            kind: 'group',
            activityId,
            title: (data?.activityTitle as string) ?? undefined,
          });
        } else {
          navigationRef.navigate('ActivityDetail', { activityId });
        }
      } catch {
        // Content no longer reachable — stay put rather than crash.
      }
    }

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) {
        handleNotificationData(response.notification.request.content.data, response.notification.request.identifier);
        void Notifications.clearLastNotificationResponseAsync();
      }
    });

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationData(response.notification.request.content.data, response.notification.request.identifier);
      void Notifications.clearLastNotificationResponseAsync();
    });

    return () => subscription.remove();
  }, [navigatePendingDailyDigest]);

  if (!fontsLoaded || (!PREVIEW_MODE && authLoading)) {
    return <LaunchScreen />;
  }

  const routeDecision = PREVIEW_MODE ? 'preview-mode' : computeRouteDecision(session, profile);
  if (!PREVIEW_MODE && session) {
    if (routeDecision === 'complete-profile') {
      console.log('[ROUTING 01] onboarding route selected', { hasProfile: Boolean(profile) });
    } else if (routeDecision === 'main-navigator') {
      console.log('[ROUTING 02] main route selected');
    }
  }

  return (
    <AppErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <NavigationContainer
            ref={navigationRef}
            onReady={() => {
              navigatePendingSharedRoute();
              navigatePendingDailyDigest();
            }}
            linking={routeDecision === 'main-navigator' && !PREVIEW_MODE ? linking : undefined}
          >
            {PREVIEW_MODE ? (
              <MainNavigator />
            ) : isPasswordRecovery || recoveryLinkStatus ? (
              // Takes priority over every other routing decision: a
              // recovery link's temporary session must never be treated as
              // "signed in" by the normal session/profile checks below —
              // it stays here until a new password is set or the user
              // backs out (cancelPasswordRecovery signs it out).
              <ResetPasswordScreen
                linkStatus={isPasswordRecovery ? 'ok' : recoveryLinkStatus!}
                onRequestNewLink={() => setRecoveryLinkStatus(null)}
              />
            ) : !session ? (
              <AuthNavigator />
            ) : routeDecision === 'complete-profile' ? (
              // Signed in but the profile is missing OR still a stub (the
              // auth-user-creation trigger now creates a profile row for
              // every account, including a first-time Apple sign-in before
              // she's entered any children — onboarding_completed stays
              // false until completeAppleProfile finishes). Checking
              // existence alone used to be correct when no row existed at
              // all until profile completion; now it must also check
              // completeness, or a first-time Apple user's session update
              // here can race ahead of AuthNavigator's own explicit
              // navigation to this same screen and land her in the main
              // app with zero children instead.
              <CompleteAppleProfileScreen
                input={{
                  children: [],
                  fallbackFullName: null,
                  fallbackEmail: session.user.email ?? null,
                }}
              />
            ) : (
              <MainNavigator />
            )}
          </NavigationContainer>
          <StatusBar style="dark" />
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </AppErrorBoundary>
  );
}

/** The permanent three-tab structure: Discovery, Chats, Profile. Everything
 *  else (activity detail, chat threads, public profiles, edit screens) is a
 *  root-stack screen pushed *over* the tabs, so the tab bar hides while
 *  drilled in and reappears on the way back — standard iOS behavior, and it
 *  keeps ActivityDetail/Chat/PublicProfile as single shared screens instead
 *  of duplicating them per tab. */
function MainNavigator() {
  usePushNotifications();

  useEffect(() => {
    console.log('[MAIN 01] main navigator mounted');
  }, []);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Tabs" component={Tabs} />
      <Stack.Screen name="ActivityDetail">
        {({ route, navigation }) => (
          <ActivityDetailContainer
            activityId={route.params.activityId}
            onBack={() => navigation.goBack()}
            navigation={navigation}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="PlaceDetails">
        {({ route, navigation }) => <PlaceDetailsScreen placeId={route.params.placeId} onBack={() => navigation.goBack()} onOpenEvent={(event) => navigation.navigate('EventDetails', { occurrenceId: event.occurrence.id })} onCreateActivity={(place) => navigation.navigate('CreateActivity', { mode: 'place', initialValues: buildActivitySeedFromPlace(place) })} />}
      </Stack.Screen>
      <Stack.Screen name="EventDetails">
        {({ route, navigation }) => <EventDetailsContainer occurrenceId={route.params.occurrenceId} onBack={() => navigation.goBack()} onOpenProfile={(userId) => navigation.navigate('PublicProfile', { userId })} />}
      </Stack.Screen>
      <Stack.Screen name="EditActivity">
        {({ route, navigation }) => (
          <EditActivityContainer
            activityId={route.params.activityId}
            onBack={() => navigation.goBack()}
            onSaved={() => navigation.goBack()}
            onCancelled={() => navigation.popToTop()}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="CreateActivity">
        {({ route, navigation }) => (
          <CreateActivityContainer navigation={navigation} routeParams={route.params} />
        )}
      </Stack.Screen>
      <Stack.Screen name="ShareActivity">
        {({ route, navigation }) => (
          <ShareActivityScreen
            activity={route.params.activity}
            onViewActivity={() =>
              navigation.replace('ActivityDetail', { activityId: route.params.activity.id })
            }
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="Chat">
        {({ route, navigation }) =>
          route.params.kind === 'forum' && route.params.forumKey ? (
            <ForumChatContainer
              forumKey={route.params.forumKey}
              title={route.params.title}
              onBack={() => navigation.goBack()}
            />
          ) : route.params.kind === 'direct' && route.params.otherUserId ? (
            <DirectChatContainer
              otherUserId={route.params.otherUserId}
              title={route.params.title}
              onBack={() => navigation.goBack()}
            />
          ) : (
            <GroupChatContainer
              activityId={route.params.activityId!}
              title={route.params.title}
              onBack={() => navigation.goBack()}
            />
          )
        }
      </Stack.Screen>
      <Stack.Screen name="PublicProfile">
        {({ route, navigation }) => (
          <PublicProfileScreen
            userId={route.params.userId}
            onBack={() => navigation.goBack()}
            onMessage={(userId, displayName) =>
              navigation.navigate('Chat', { kind: 'direct', otherUserId: userId, title: displayName })
            }
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="EditProfile">
        {({ navigation }) => <EditProfileScreen onBack={() => navigation.goBack()} />}
      </Stack.Screen>
      <Stack.Screen name="BlockedUsers">
        {({ navigation }) => <BlockedUsersScreen onBack={() => navigation.goBack()} />}
      </Stack.Screen>
      <Stack.Screen name="MyActivities">
        {({ navigation }) => (
          <MyActivitiesScreen
            onBack={() => navigation.goBack()}
            onOpenActivity={(activity) => navigation.navigate('ActivityDetail', { activityId: activity.id })}
          />
        )}
      </Stack.Screen>
      <Stack.Screen name="DailyDigest" options={{ presentation: 'modal' }}>
        {({ route, navigation }) => (
          <DailyDigestScreen
            requestedDate={route.params?.date}
            onClose={() => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Tabs'))}
            onOpenEvent={(occurrenceId) => navigation.navigate('EventDetails', { occurrenceId })}
          />
        )}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function Tabs() {
  // Route NAMES stay English — they are internal identifiers that deep links
  // and navigation calls depend on. Only the visible tabBarLabel is localized.
  const { t } = useI18n();
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.brand.primary,
        tabBarInactiveTintColor: theme.text.muted,
        tabBarStyle: { backgroundColor: theme.background.surface, borderTopColor: theme.border.default },
      }}
    >
      <Tab.Screen
        name="Discovery"
        options={{ tabBarLabel: t('nav.discovery'), tabBarIcon: ({ color, size }) => <Compass size={size} color={color} weight="fill" /> }}
      >
        {({ navigation }) => <DiscoverScreenContainer navigation={navigation} />}
      </Tab.Screen>
      <Tab.Screen
        name="Chats"
        options={{ tabBarLabel: t('nav.chats'), tabBarIcon: ({ color, size }) => <ChatCircleDots size={size} color={color} weight="fill" /> }}
      >
        {({ navigation }) => (
          <MessagesScreen
            onOpenConversation={(conversation: Conversation) =>
              navigation.getParent()?.navigate('Chat', {
                kind: conversation.kind,
                activityId: conversation.activityId ?? undefined,
                otherUserId: conversation.otherUserId ?? undefined,
                title: conversation.title,
              })
            }
            onOpenForum={(forum) =>
              navigation.getParent()?.navigate('Chat', {
                kind: 'forum',
                forumKey: forum.key,
                // Resolved here so the chat header reads in the user's
                // language rather than the catalogue's English fallback.
                title: t(forum.titleKey),
              })
            }
            onCreateActivity={() => navigation.getParent()?.navigate('CreateActivity')}
          />
        )}
      </Tab.Screen>
      <Tab.Screen
        name="Profile"
        options={{ tabBarLabel: t('nav.profile'), tabBarIcon: ({ color, size }) => <UserCircle size={size} color={color} weight="fill" /> }}
      >
        {({ navigation }) => (
          <ProfileScreen
            onEditProfile={() => navigation.getParent()?.navigate('EditProfile')}
            onOpenMyActivities={() => navigation.getParent()?.navigate('MyActivities')}
            onOpenBlockedUsers={() => navigation.getParent()?.navigate('BlockedUsers')}
          />
        )}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

function DiscoverScreenContainer({ navigation }: { navigation: any }) {
  const { t } = useI18n();
  const handleOpenActivity = useCallback(
    (activity: Activity) => {
      navigation.getParent()?.navigate('ActivityDetail', { activityId: activity.id });
    },
    [navigation],
  );
  const handleOpenPlace = useCallback((place: FamilyFriendlyPlace) => {
    navigation.getParent()?.navigate('PlaceDetails', { placeId: place.id });
  }, [navigation]);
  const handleOpenEvent = useCallback((event: EventDetails) => {
    navigation.getParent()?.navigate('EventDetails', { occurrenceId: event.occurrence.id });
  }, [navigation]);
  const [previewShowEmpty, setPreviewShowEmpty] = React.useState(false);

  useEffect(() => {
    console.log('[HOME 01] initial screen mounted');
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <DiscoverScreen
        onOpenActivity={handleOpenActivity}
        onOpenPlace={handleOpenPlace}
        onOpenEvent={handleOpenEvent}
        onHostActivity={() => navigation.getParent()?.navigate('CreateActivity')}
        mockActivities={PREVIEW_MODE ? (previewShowEmpty ? MOCK_ACTIVITIES_EMPTY : MOCK_ACTIVITIES) : undefined}
        mockPlaces={PREVIEW_MODE ? MOCK_FAMILY_FRIENDLY_PLACES : undefined}
        mockEvents={PREVIEW_MODE ? (previewShowEmpty ? [] : MOCK_EVENTS) : undefined}
      />
      {PREVIEW_MODE && (
        <Pressable
          onPress={() => setPreviewShowEmpty((v) => !v)}
          style={{
            position: 'absolute',
            top: 108,
            right: 20,
            backgroundColor: theme.text.primary,
            paddingHorizontal: 14,
            paddingVertical: 8,
            borderRadius: 999,
            opacity: 0.92,
          }}
        >
          <Text style={{ color: theme.text.inverse, fontSize: 12, fontWeight: '700' }}>
            {t('dev.preview', { state: previewShowEmpty ? t('dev.showPopulated') : t('dev.showEmpty') })}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

function ActivityDetailContainer({
  activityId,
  onBack,
  navigation,
}: {
  activityId: string;
  onBack: () => void;
  navigation: any;
}) {
  const { t } = useI18n();
  const { detail, isLoading, error, refresh } = useActivityDetail(activityId);

  // Activity Detail stays mounted underneath Edit/Chat in this stack (React
  // Navigation doesn't unmount screens it pushes over), so without this a
  // saved edit or a newly-read chat never shows up here until some other
  // navigation forces a remount.
  useFocusEffect(
    useCallback(() => {
      refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  if (!detail) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background.surface }}>
        {isLoading ? <ActivityIndicator color={theme.brand.primary} /> : null}
        {error ? <><Text style={{ color: theme.text.secondary }}>{error}</Text><Pressable onPress={refresh}><Text style={{ color: theme.brand.primary, fontWeight: '700' }}>{t('common.retry')}</Text></Pressable></> : null}
      </View>
    );
  }

  return <ActivityDetailWithRsvp detail={detail} onBack={onBack} navigation={navigation} refresh={refresh} />;
}

function EventDetailsContainer({ occurrenceId, onBack, onOpenProfile }: { occurrenceId: string; onBack: () => void; onOpenProfile?: (userId: string) => void }) {
  const { t } = useI18n();
  const { event, isLoading, error, refresh } = useEventDetails(occurrenceId);
  if (event) return <EventDetailsScreen event={event} onBack={onBack} onOpenProfile={onOpenProfile} />;
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, backgroundColor: theme.background.app }}>
    {isLoading ? <ActivityIndicator color={theme.brand.primary} /> : null}
    {error ? <><Text style={{ color: theme.text.secondary }}>{error}</Text><Pressable onPress={refresh}><Text style={{ color: theme.brand.primary, fontWeight: '700' }}>{t('common.retry')}</Text></Pressable></> : null}
  </View>;
}

function ActivityDetailWithRsvp({
  detail,
  onBack,
  navigation,
  refresh,
}: {
  detail: NonNullable<ReturnType<typeof useActivityDetail>['detail']>;
  onBack: () => void;
  navigation: any;
  refresh: () => Promise<void>;
}) {
  const { t } = useI18n();
  const { activity, isSubmitting, join, leave } = useActivityRsvp(detail, refresh);
  const { session } = useAuth();
  const isHost = session?.user.id === activity.hostId;
  const { chatId } = useActivityChatId(activity.id);
  const { hasUnread, refresh: refreshUnread } = useHasUnread(chatId);

  useFocusEffect(
    useCallback(() => {
      refreshUnread();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [chatId]),
  );

  useEffect(() => {
    track('activity_opened', { content_id: activity.id, source: 'user' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity.id]);

  const openChat = () => {
    navigation.navigate('Chat', { kind: 'group', activityId: activity.id, title: activity.title });
  };

  return (
    <ActivityDetailScreen
      activity={activity}
      onBack={onBack}
      onMessageHost={() => {
        navigation.navigate('Chat', {
          kind: 'direct',
          otherUserId: activity.hostId,
          title: activity.host.displayName,
        });
      }}
      onOpenPerson={(userId: string) => navigation.navigate('PublicProfile', { userId })}
      onJoined={openChat}
      onOpenChat={openChat}
      canOpenChat={isHost || activity.viewerStatus === 'going'}
      hasUnreadChat={hasUnread}
      isHost={isHost}
      onEdit={() => navigation.navigate('EditActivity', { activityId: activity.id })}
      onCreateAgain={() =>
        navigation.navigate('CreateActivity', {
          mode: 'again',
          initialValues: buildCreateAgainSeed(activity),
        })
      }
    />
  );
}

/** Forums reuse ChatScreen wholesale. The only extra step is resolving the
 *  forum key to a chat id, which also joins the user transparently — forum
 *  membership exists purely to satisfy the participation-based RLS that
 *  already guards every chat, and is never surfaced as a "Join" button. */
function ForumChatContainer({
  forumKey,
  title,
  onBack,
}: {
  forumKey: ForumKey;
  title?: string;
  onBack: () => void;
}) {
  const { t } = useI18n();
  const [chatId, setChatId] = React.useState<string | null>(null);
  const [resolveError, setResolveError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    track('forum_opened', { forum_key: forumKey });
    openForum(forumKey).then((id) => {
      if (cancelled) return;
      if (id) {
        setChatId(id);
        track('forum_joined', { forum_key: forumKey });
      }
      else setResolveError(t('error.forumOpen'));
    });
    return () => {
      cancelled = true;
    };
  }, [forumKey, t]);

  return <ChatScreen chatId={chatId} resolveError={resolveError} title={title ?? ''} onBack={onBack} analyticsEvent="forum_message_sent" />;
}

function GroupChatContainer({
  activityId,
  title,
  onBack,
}: {
  activityId: string;
  title?: string;
  onBack: () => void;
}) {
  const { chatId, error } = useActivityChatId(activityId);
  const [resolvedTitle, setResolvedTitle] = React.useState(title ?? '');

  React.useEffect(() => {
    setActiveChat({ type: 'group', activityId });
    return () => setActiveChat(null);
  }, [activityId]);

  React.useEffect(() => {
    if (chatId) supabase.rpc('mark_chat_read', { p_chat_id: chatId });
  }, [chatId]);

  React.useEffect(() => {
    if (title || resolvedTitle) return;
    // Deep link / notification tap landed here without a title in the
    // route params — fetch it so the header isn't blank.
    supabase
      .from('activities')
      .select('title')
      .eq('id', activityId)
      .single()
      .then(({ data }: { data: { title: string } | null }) => {
        if (data?.title) setResolvedTitle(data.title);
      });
  }, [activityId, title, resolvedTitle]);

  return (
    <ChatScreen chatId={chatId} resolveError={error} title={resolvedTitle || 'Chat'} onBack={onBack} />
  );
}

function DirectChatContainer({
  otherUserId,
  title,
  onBack,
}: {
  otherUserId: string;
  title?: string;
  onBack: () => void;
}) {
  const { chatId, error } = useDirectChatId(otherUserId);

  React.useEffect(() => {
    setActiveChat({ type: 'direct', otherUserId });
    return () => setActiveChat(null);
  }, [otherUserId]);

  React.useEffect(() => {
    if (chatId) supabase.rpc('mark_chat_read', { p_chat_id: chatId });
  }, [chatId]);

  return <ChatScreen chatId={chatId} resolveError={error} title={title ?? 'Chat'} onBack={onBack} />;
}

function EditActivityContainer({
  activityId,
  onBack,
  onSaved,
  onCancelled,
}: {
  activityId: string;
  onBack: () => void;
  onSaved: () => void;
  onCancelled: () => void;
}) {
  const { detail, isLoading } = useActivityDetail(activityId);

  if (!detail) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background.app }}>
        {isLoading ? <ActivityIndicator color={theme.brand.primary} /> : null}
      </View>
    );
  }

  return (
    <EditActivityScreen activity={detail} onBack={onBack} onSaved={onSaved} onCancelled={onCancelled} />
  );
}

function CreateActivityContainer({
  navigation,
  routeParams,
}: {
  navigation: any;
  routeParams?: RootStackParamList['CreateActivity'];
}) {
  const initialCoords = useInitialLocation();

  return (
    <CreateActivityScreen
      {...(routeParams?.mode === 'again'
        ? { mode: 'again' as const, initialValues: routeParams.initialValues }
        : {
            mode: 'create' as const,
            initialLatitude: initialCoords.latitude,
            initialLongitude: initialCoords.longitude,
            initialValues: routeParams?.mode === 'place' ? routeParams.initialValues : undefined,
          })}
      onBack={() => navigation.goBack()}
      onCreated={(activityId: string, input: CreateActivityInput) => {
        navigation.replace('ShareActivity', {
          activity: {
            id: activityId,
            title: input.title,
            category: input.activityType,
            startsAt: input.startsAt,
            locationName: input.locationName,
            durationMinutes: input.durationMinutes,
            babyMinAgeMonths: input.babyMinAgeMonths,
            babyMaxAgeMonths: input.babyMaxAgeMonths,
          },
        });
      }}
    />
  );
}

function useInitialLocation() {
  const [coords, setCoords] = React.useState<{ latitude: number; longitude: number }>(FALLBACK_LOCATION);

  React.useEffect(() => {
    let cancelled = false;
    Location.getLastKnownPositionAsync()
      .then((position) => {
        if (!cancelled && position) {
          setCoords({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return coords;
}
