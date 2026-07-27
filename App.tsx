import React, { useCallback, useEffect, useMemo } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, LinkingOptions, createNavigationContainerRef } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
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
import { LaunchScreen } from '@/screens/LaunchScreen';
import { CompleteAppleProfileScreen } from '@/screens/auth/CompleteAppleProfileScreen';
import { AuthNavigator } from '@/navigation/AuthNavigator';
import { theme } from '@/theme';
import { useAuth } from '@/hooks/useAuth';
import { useActivityDetail } from '@/hooks/useActivityDetail';
import { useActivityRsvp } from '@/hooks/useActivityRsvp';
import { useActivityChatId } from '@/hooks/useActivityChatId';
import { useDirectChatId } from '@/hooks/useDirectChatId';
import { useHasUnread } from '@/hooks/useHasUnread';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import { supabase } from '@/lib/supabase';
import { setActiveChat } from '@/lib/activeChatTracker';
import type { Activity } from '@/types/activity';
import type { CreateActivityInput } from '@/hooks/useCreateActivity';
import type { ShareableActivity } from '@/utils/buildShareMessage';

export type RootStackParamList = {
  Discover: undefined;
  ActivityDetail: { activityId: string };
  EditActivity: { activityId: string };
  CreateActivity: undefined;
  ShareActivity: { activity: ShareableActivity };
  Chat: { kind: 'group' | 'direct'; activityId?: string; otherUserId?: string; title?: string };
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['momzi://'],
  config: {
    screens: {
      Discover: '',
      ActivityDetail: 'activity/:activityId',
      EditActivity: 'activity/:activityId/edit',
      CreateActivity: 'create',
      Profile: 'profile',
      ShareActivity: 'share',
      Chat: {
        path: 'activity/:activityId/chat',
        parse: { kind: () => 'group' as const },
      },
    },
  },
};

export default function App() {
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
      const activityId = data?.activityId as string | undefined;
      if (!activityId || !navigationRef.isReady()) return;
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

  if (!fontsLoaded || authLoading) {
    return <LaunchScreen />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer ref={navigationRef} linking={session && profile ? linking : undefined}>
          {!session ? (
            <AuthNavigator />
          ) : !profile ? (
            // Signed in but the profile row never got created (interrupted
            // registration, or an Apple sign-in that didn't finish the
            // completion step) — recover with the same completion form.
            <CompleteAppleProfileScreen
              input={{
                phone: '',
                babyName: '',
                babyBirthdate: '',
                photoUri: null,
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
  );
}

function MainNavigator() {
  usePushNotifications();

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Discover">
        {({ navigation }) => <DiscoverScreenContainer navigation={navigation} />}
      </Stack.Screen>
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
      <Stack.Screen name="Profile">
        {({ navigation }) => <ProfileScreen onBack={() => navigation.goBack()} />}
      </Stack.Screen>
    </Stack.Navigator>
  );
}

function DiscoverScreenContainer({ navigation }: { navigation: any }) {
  const handleOpenActivity = useCallback(
    (activity: Activity) => {
      navigation.navigate('ActivityDetail', { activityId: activity.id });
    },
    [navigation],
  );

  return (
    <DiscoverScreen
      onOpenActivity={handleOpenActivity}
      onOpenSearch={() => {
        // TODO: build the search + filters sheet
      }}
      onOpenNotifications={() => {
        // TODO: build the notifications screen
      }}
      onOpenProfile={() => navigation.navigate('Profile')}
      onHostActivity={() => navigation.navigate('CreateActivity')}
    />
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
  const { detail, isLoading, error } = useActivityDetail(activityId);

  if (!detail) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background.surface }}>
        {isLoading ? <ActivityIndicator color={theme.brand.primary} /> : null}
        {error ? null : null}
      </View>
    );
  }

  return <ActivityDetailWithRsvp detail={detail} onBack={onBack} navigation={navigation} />;
}

function ActivityDetailWithRsvp({
  detail,
  onBack,
  navigation,
}: {
  detail: NonNullable<ReturnType<typeof useActivityDetail>['detail']>;
  onBack: () => void;
  navigation: any;
}) {
  const { activity, isSubmitting, join, leave } = useActivityRsvp(detail);
  const { session } = useAuth();
  const isHost = session?.user.id === activity.hostId;
  const { chatId } = useActivityChatId(activity.id);
  const hasUnread = useHasUnread(chatId);

  const openChat = () => {
    navigation.navigate('Chat', { kind: 'group', activityId: activity.id, title: activity.title });
  };

  return (
    <ActivityDetailScreen
      activity={activity}
      onBack={onBack}
      onReport={() => {
        // TODO: wire to reports table once the report flow UI exists
      }}
      onMessageHost={() => {
        navigation.navigate('Chat', {
          kind: 'direct',
          otherUserId: activity.hostId,
          title: activity.host.displayName,
        });
      }}
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

const FALLBACK_LOCATION = { latitude: 32.0853, longitude: 34.7818 };

function useInitialLocation() {
  const [coords, setCoords] = React.useState(FALLBACK_LOCATION);

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
