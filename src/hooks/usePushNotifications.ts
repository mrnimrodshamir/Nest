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
 * Registers this device for push notifications and, when granted, upserts
 * the Expo push token. `promptIfNeeded` controls whether the OS permission
 * dialog can actually appear here — per product requirements, that dialog
 * should only ever be triggered by joining a first activity or turning on
 * reminders in settings (see those two call sites), never proactively on
 * app launch. Passing false lets launch-time calls silently pick up a
 * permission the user already granted, without ever prompting.
 */
export async function ensurePushRegistration(promptIfNeeded: boolean): Promise<boolean> {
  if (!Device.isDevice) return false;

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let status = existingStatus;
  if (status === 'undetermined' && promptIfNeeded) {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') return false;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const { data: userData } = await supabase.auth.getUser();
  const user = userData.user;
  if (!user) return true; // permission granted, but no session to attach a token to yet

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    await supabase.from('push_tokens').upsert(
      { user_id: user.id, token },
      { onConflict: 'user_id,token' },
    );
  } catch {
    // Push registration is best-effort — never block the app on it.
  }

  return true;
}

/** Mount-time hook: silently syncs the push token if permission was already
 *  granted in a prior session. Never shows the permission prompt itself. */
export function usePushNotifications() {
  useEffect(() => {
    ensurePushRegistration(false);
  }, []);
}
