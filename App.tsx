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
import { AuthScreen } from '@/screens/AuthScreen';
import { useAuth } from '@/hooks/useAuth';
import { useActivityDetail } from '@/hooks/useActivityDetail';
import type { Activity } from '@/types/activity';

export type RootStackParamList = {
  Discover: undefined;
  ActivityDetail: { activity: Activity };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [fontsLoaded] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
  });
  const { session, isLoading: authLoading } = useAuth();

  if (!fontsLoaded || authLoading) {
    return null; // TODO: swap for a branded splash/loading state
  }

  if (!session) {
    return (
      <SafeAreaProvider>
        <AuthScreen />
        <StatusBar style="dark" />
      </SafeAreaProvider>
    );
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
                <ActivityDetailContainer
                  activity={route.params.activity}
                  onBack={() => navigation.goBack()}
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
      navigation.navigate('ActivityDetail', { activity });
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

function ActivityDetailContainer({
  activity,
  onBack,
}: {
  activity: Activity;
  onBack: () => void;
}) {
  const { detail } = useActivityDetail(activity);

  return (
    <ActivityDetailScreen
      activity={detail}
      onBack={onBack}
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
  );
}
