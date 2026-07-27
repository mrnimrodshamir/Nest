import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '@/lib/supabase';
import { isNotificationForActiveChat } from '@/lib/activeChatTracker';

const LAST_TOKEN_KEY = 'momzi.pushToken';

Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    // The open ChatScreen already renders new messages via its realtime
    // subscription — a foreground banner for that exact conversation would
    // just be a redundant, noisy duplicate.
    const suppress = isNotificationForActiveChat(notification.request.content.data);
    return {
      shouldShowAlert: !suppress,
      shouldPlaySound: !suppress,
      shouldSetBadge: false,
    };
  },
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
  if (status !== 'granted') {
    console.log('[Push] permission not granted', { status });
    return false;
  }

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
    // Remember which token belongs to *this device* so sign-out only removes
    // this device's row, never a different device the user is also signed
    // into.
    await AsyncStorage.setItem(LAST_TOKEN_KEY, token);
    console.log('[Push] token registered');
  } catch (err) {
    console.log('[Push] token registration failed', err instanceof Error ? err.message : err);
  }

  return true;
}

/** Removes this device's push token on sign-out so a signed-out device
 *  stops receiving another account's notifications if someone else signs
 *  into the same device later. Leaves other devices' tokens untouched. */
export async function clearPushRegistration(userId: string): Promise<void> {
  const token = await AsyncStorage.getItem(LAST_TOKEN_KEY);
  if (!token) return;
  try {
    await supabase.from('push_tokens').delete().match({ user_id: userId, token });
    await AsyncStorage.removeItem(LAST_TOKEN_KEY);
    console.log('[Push] token cleared on sign-out');
  } catch (err) {
    console.log('[Push] token cleanup failed', err instanceof Error ? err.message : err);
  }
}

/** Mount-time hook: silently syncs the push token if permission was already
 *  granted in a prior session. Never shows the permission prompt itself. */
export function usePushNotifications() {
  useEffect(() => {
    ensurePushRegistration(false);
  }, []);
}
