import React, { useCallback, useMemo } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, LinkingOptions } from '@react-navigation/native';
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
import { ProfileScreen } from '@/screens/ProfileScreen';
import { CompleteAppleProfileScreen } from '@/screens/auth/CompleteAppleProfileScreen';
import { AuthNavigator } from '@/navigation/AuthNavigator';
import { theme } from '@/theme';
import { useAuth } from '@/hooks/useAuth';
import { useActivityDetail } from '@/hooks/useActivityDetail';
import { useActivityRsvp } from '@/hooks/useActivityRsvp';
import { usePushNotifications } from '@/hooks/usePushNotifications';
import type { Activity } from '@/types/activity';
import type { CreateActivityInput } from '@/hooks/useCreateActivity';
import type { ShareableActivity } from '@/utils/buildShareMessage';

export type RootStackParamList = {
  Discover: undefined;
  ActivityDetail: { activityId: string };
  CreateActivity: undefined;
  ShareActivity: { activity: ShareableActivity };
  Chat: { activityId: string; activityTitle: string };
  Profile: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['momzi://'],
  config: {
    screens: {
      Discover: '',
      ActivityDetail: 'activity/:activityId',
      CreateActivity: 'create',
      Profile: 'profile',
      ShareActivity: 'share',
      Chat: 'activity/:activityId/chat',
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

  if (!fontsLoaded || authLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background.app }}>
        <ActivityIndicator color={theme.brand.primary} />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer linking={session && profile ? linking : undefined}>
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
        {({ route, navigation }) => (
          <ChatScreen
            activityId={route.params.activityId}
            activityTitle={route.params.activityTitle}
            onBack={() => navigation.goBack()}
          />
        )}
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

  const openChat = () => {
    navigation.navigate('Chat', { activityId: activity.id, activityTitle: activity.title });
  };

  return (
    <ActivityDetailScreen
      activity={activity}
      onBack={onBack}
      onReport={() => {
        // TODO: wire to reports table once the report flow UI exists
      }}
      onMessageHost={() => {
        // TODO: wire to get_or_create_direct_chat once a direct-message UI exists
      }}
      onJoined={openChat}
      onOpenChat={openChat}
      canOpenChat={isHost || activity.viewerStatus === 'going'}
    />
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
