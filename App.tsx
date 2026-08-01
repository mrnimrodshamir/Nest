import React, { useCallback, useEffect, useMemo } from 'react';
import { View, ActivityIndicator, Pressable, Text, I18nManager } from 'react-native';
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

import { DiscoverScreen } from '@/screens/DiscoverScreen';
import { ActivityDetailScreen } from '@/screens/ActivityDetailScreen';
import { CreateActivityScreen } from '@/screens/CreateActivityScreen';
import { ShareActivityScreen } from '@/screens/ShareActivityScreen';
import { ChatScreen } from '@/screens/ChatScreen';
import { EditActivityScreen } from '@/screens/EditActivityScreen';
import { ProfileScreen } from '@/screens/ProfileScreen';
import { EditProfileScreen } from '@/screens/EditProfileScreen';
import { MyActivitiesScreen } from '@/screens/MyActivitiesScreen';
import { MessagesScreen } from '@/screens/MessagesScreen';
import { BlockedUsersScreen } from '@/screens/BlockedUsersScreen';
import { PublicProfileScreen } from '@/screens/PublicProfileScreen';
import { LaunchScreen } from '@/screens/LaunchScreen';
import { CompleteAppleProfileScreen } from '@/screens/auth/CompleteAppleProfileScreen';
import { AuthNavigator } from '@/navigation/AuthNavigator';
import { AppErrorBoundary } from '@/components/AppErrorBoundary';
import { theme } from '@/theme';
import { useAuth, AuthProvider } from '@/hooks/useAuth';
import { computeRouteDecision } from '@/lib/routing';
import { useActivityDetail } from '@/hooks/useActivityDetail';
import { useActivityRsvp } from '@/hooks/useActivityRsvp';
import { useActivityChatId } from '@/hooks/useActivityChatId';
import { useDirectChatId } from '@/hooks/useDirectChatId';
import { useHasUnread } from '@/hooks/useHasUnread';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { supabase } from '@/lib/supabase';
import { setActiveChat } from '@/lib/activeChatTracker';
import { track } from '@/lib/analytics';
import { FALLBACK_LOCATION } from '@/constants/location';
import { MOCK_ACTIVITIES, MOCK_ACTIVITIES_EMPTY } from '@/mocks/mockActivities';
import type { Activity } from '@/types/activity';
import type { Conversation } from '@/hooks/useConversations';
import type { CreateActivityInput } from '@/hooks/useCreateActivity';
import type { ShareableActivity } from '@/utils/buildShareMessage';

// This release is English/LTR only (see theme docs) — but React Native
// mirrors flexDirection: 'row' layouts automatically based on the
// device's OS language, not the app's displayed text language. A tester
// with their iPhone system language set to a RTL language (Hebrew,
// Arabic, etc.) would see every row-based layout — chat rows, button
// rows, meta lines — flip direction even though all the text stays
// English. Forcing LTR here fixes that regardless of device locale.
// Note: RN only applies a forceRTL change starting the *next* app
// launch, not retroactively mid-session — this takes effect after the
// app is fully closed and reopened once.
if (I18nManager.isRTL) {
  I18nManager.allowRTL(false);
  I18nManager.forceRTL(false);
}

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
  CreateActivity: undefined;
  ShareActivity: { activity: ShareableActivity };
  Chat: { kind: 'group' | 'direct'; activityId?: string; otherUserId?: string; title?: string };
  PublicProfile: { userId: string };
  EditProfile: undefined;
  MyActivities: undefined;
  BlockedUsers: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['momzi://'],
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
      EditActivity: 'activity/:activityId/edit',
      CreateActivity: 'create',
      ShareActivity: 'share',
      PublicProfile: 'member/:userId',
      Chat: {
        path: 'activity/:activityId/chat',
        parse: { kind: () => 'group' as const },
      },
    },
  },
};

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
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
  const { session, profile, isLoading: authLoading } = useAuth();

  useEffect(() => {
    // Safe fallback if the tapped notification references content that no
    // longer exists — try/catch around navigation, since a bad or stale
    // activityId shouldn't crash the app.
    function handleNotificationData(data: Record<string, unknown> | undefined) {
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
      if (response) handleNotificationData(response.notification.request.content.data);
    });

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationData(response.notification.request.content.data);
    });

    return () => subscription.remove();
  }, []);

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
          <NavigationContainer ref={navigationRef} linking={session && profile?.onboardingCompleted && !PREVIEW_MODE ? linking : undefined}>
            {PREVIEW_MODE ? (
              <MainNavigator />
            ) : !session ? (
              <AuthNavigator />
            ) : !profile || !profile.onboardingCompleted ? (
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
        {({ navigation }) => <CreateActivityContainer navigation={navigation} />}
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
          route.params.kind === 'direct' && route.params.otherUserId ? (
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
    </Stack.Navigator>
  );
}

function Tabs() {
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
        options={{ tabBarIcon: ({ color, size }) => <Compass size={size} color={color} weight="fill" /> }}
      >
        {({ navigation }) => <DiscoverScreenContainer navigation={navigation} />}
      </Tab.Screen>
      <Tab.Screen
        name="Chats"
        options={{ tabBarIcon: ({ color, size }) => <ChatCircleDots size={size} color={color} weight="fill" /> }}
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
            onCreateActivity={() => navigation.getParent()?.navigate('CreateActivity')}
          />
        )}
      </Tab.Screen>
      <Tab.Screen
        name="Profile"
        options={{ tabBarIcon: ({ color, size }) => <UserCircle size={size} color={color} weight="fill" /> }}
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
  const handleOpenActivity = useCallback(
    (activity: Activity) => {
      navigation.getParent()?.navigate('ActivityDetail', { activityId: activity.id });
    },
    [navigation],
  );
  const [previewShowEmpty, setPreviewShowEmpty] = React.useState(false);

  useEffect(() => {
    console.log('[HOME 01] initial screen mounted');
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <DiscoverScreen
        onOpenActivity={handleOpenActivity}
        onHostActivity={() => navigation.getParent()?.navigate('CreateActivity')}
        mockActivities={PREVIEW_MODE ? (previewShowEmpty ? MOCK_ACTIVITIES_EMPTY : MOCK_ACTIVITIES) : undefined}
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
            Preview: {previewShowEmpty ? 'show populated' : 'show empty state'}
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
        {error ? null : null}
      </View>
    );
  }

  return <ActivityDetailWithRsvp detail={detail} onBack={onBack} navigation={navigation} refresh={refresh} />;
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
    track('activity_viewed', { activity_id: activity.id });
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
    />
  );
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

function CreateActivityContainer({ navigation }: { navigation: any }) {
  const initialCoords = useInitialLocation();

  return (
    <CreateActivityScreen
      onBack={() => navigation.goBack()}
      initialLatitude={initialCoords.latitude}
      initialLongitude={initialCoords.longitude}
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
