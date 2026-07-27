import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { supabase } from '@/lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Registers this device for push once signed in. Only handles permission +
 * token registration — the send side (DB triggers -> Edge Function -> Expo
 * push API for activity changes, chat messages, reminders) is a deliberate
 * follow-up, not part of this vertical slice.
 */
export function usePushNotifications() {
  useEffect(() => {
    if (!Device.isDevice) return; // push tokens aren't available on simulators

    let cancelled = false;

    async function register() {
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }
      if (finalStatus !== 'granted' || cancelled) return;

      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.DEFAULT,
        });
      }

      const projectId = Constants.expoConfig?.extra?.eas?.projectId;
      const { data: userData } = await supabase.auth.getUser();
      const user = userData.user;
      if (!user || cancelled) return;

      try {
        const { data: token } = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        );
        if (cancelled) return;
        await supabase.from('push_tokens').upsert(
          { user_id: user.id, token },
          { onConflict: 'user_id,token' },
        );
      } catch {
        // Push registration is best-effort — never block the app on it.
      }
    }

    register();
    return () => {
      cancelled = true;
    };
  }, []);
}
