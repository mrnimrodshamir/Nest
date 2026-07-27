import React, { useCallback } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFonts } from '@expo-google-fonts/plus-jakarta-sans/useFonts';
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
} from '@expo-google-fonts/plus-jakarta-sans';
import { StatusBar } from 'expo-status-bar';

import { DiscoverScreen } from '@/screens/DiscoverScreen';
import { ActivityDetailScreen } from '@/screens/ActivityDetailScreen';
import type { Activity, ActivityDetail } from '@/types/activity';

export type RootStackParamList = {
  Discover: undefined;
  ActivityDetail: { activity: ActivityDetail };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * TODO(supabase): DiscoverScreen only has the lightweight Activity shape.
 * Replace this with a real fetch-by-id when navigating, rather than padding
 * in placeholder detail fields — this adapter exists purely so the two
 * screens we've built so far are connectable before that wiring exists.
 */
function toPlaceholderDetail(activity: Activity): ActivityDetail {
  return {
    ...activity,
    description:
      'Full activity details will load from Supabase once the detail fetch is wired up.',
    location: {
      label: 'Location details coming soon',
      latitude: activity.latitude,
      longitude: activity.longitude,
    },
    host: {
      id: activity.hostId,
      displayName: 'Host',
      avatarUrl: null,
      avatarColor: '#8FB4C9',
      verified: false,
      bio: null,
    },
    viewerStatus: 'none',
  };
}

export default function App() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });

  if (!fontsLoaded) {
    return null; // TODO: swap for a branded splash/loading state
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <NavigationContainer>
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            <Stack.Screen name="Discover">
              {({ navigation }) => (
                <DiscoverScreenContainer navigation={navigation} />
              )}
            </Stack.Screen>
            <Stack.Screen name="ActivityDetail">
              {({ route, navigation }) => (
                <ActivityDetailScreen
                  activity={route.params.activity}
                  onBack={() => navigation.goBack()}
                  onReport={() => {
                    // TODO: wire to reports table once the report flow UI exists
                  }}
                  onMessageHost={() => {
                    // TODO: wire to get_or_create_direct_chat once Chat is built
                  }}
                  onJoined={() => {
                    // TODO: navigate into the activity's group chat once Chat is built
                  }}
                />
              )}
            </Stack.Screen>
          </Stack.Navigator>
        </NavigationContainer>
        <StatusBar style="dark" />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

function DiscoverScreenContainer({ navigation }: { navigation: any }) {
  const handleOpenActivity = useCallback(
    (activity: Activity) => {
      navigation.navigate('ActivityDetail', {
        activity: toPlaceholderDetail(activity),
      });
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
      onHostActivity={() => {
        // TODO: build the Create/Host activity flow
      }}
    />
  );
}
