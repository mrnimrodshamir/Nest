import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ensurePushRegistration } from '@/hooks/usePushNotifications';

interface ReminderActivity {
  id: string;
  title: string;
  startsAt: Date;
}

const STORAGE_PREFIX = 'momzi.reminders.';
const REMINDER_OFFSETS_HOURS = [24, 2];

async function getStoredIds(activityId: string): Promise<string[]> {
  const raw = await AsyncStorage.getItem(STORAGE_PREFIX + activityId);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as string[];
  } catch {
    return [];
  }
}

async function setStoredIds(activityId: string, ids: string[]): Promise<void> {
  if (ids.length === 0) await AsyncStorage.removeItem(STORAGE_PREFIX + activityId);
  else await AsyncStorage.setItem(STORAGE_PREFIX + activityId, JSON.stringify(ids));
}

/** Cancels any previously scheduled reminders for this activity. Safe to
 *  call even if none exist. */
export async function cancelActivityReminders(activityId: string): Promise<void> {
  const ids = await getStoredIds(activityId);
  await Promise.all(ids.map((id) => Notifications.cancelScheduledNotificationAsync(id).catch(() => {})));
  await setStoredIds(activityId, []);
}

/**
 * Schedules the default 24h/2h-before reminders for an activity the person
 * just joined. This is one of the only two moments allowed to trigger the
 * OS notification permission prompt (the other is the reminders toggle in
 * settings) — never called proactively elsewhere.
 */
export async function scheduleActivityReminders(
  activity: ReminderActivity,
  remindersEnabled: boolean,
): Promise<void> {
  await cancelActivityReminders(activity.id);
  if (!remindersEnabled) return;

  const granted = await ensurePushRegistration(true);
  if (!granted) return;

  const now = Date.now();
  const scheduledIds: string[] = [];

  for (const hoursBefore of REMINDER_OFFSETS_HOURS) {
    const triggerDate = new Date(activity.startsAt.getTime() - hoursBefore * 3600_000);
    if (triggerDate.getTime() <= now) continue; // don't schedule reminders in the past

    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: activity.title,
        body:
          hoursBefore >= 24
            ? `Tomorrow: ${activity.title}`
            : `Starting in ${hoursBefore} hours: ${activity.title}`,
        data: { activityId: activity.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: triggerDate },
    });
    scheduledIds.push(id);
  }

  await setStoredIds(activity.id, scheduledIds);
}

/** Re-schedules reminders against a new start time (host changed the time).
 *  No-op if this device never had reminders set for the activity. */
export async function rescheduleActivityReminders(
  activity: ReminderActivity,
  remindersEnabled: boolean,
): Promise<void> {
  const hadReminders = (await getStoredIds(activity.id)).length > 0;
  if (!hadReminders) return;
  await scheduleActivityReminders(activity, remindersEnabled);
}
