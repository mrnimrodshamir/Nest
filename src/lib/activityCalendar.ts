import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { activityDeepLink } from '@/utils/buildShareMessage';

interface CalendarActivityInfo {
  id: string;
  title: string;
  description: string;
  startsAt: Date;
  durationMinutes: number;
  locationName: string;
}

interface StoredCalendarLink {
  eventId: string;
  startTime: string; // ISO — used to detect drift when the activity changes
  locationName: string;
}

const STORAGE_PREFIX = 'nestup.calendarEvent.';
const inFlightAdds = new Map<string, Promise<{ success: boolean; error?: string }>>();

async function getStoredLink(activityId: string): Promise<StoredCalendarLink | null> {
  const raw = await AsyncStorage.getItem(STORAGE_PREFIX + activityId);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredCalendarLink;
  } catch {
    return null;
  }
}

async function setStoredLink(activityId: string, link: StoredCalendarLink | null): Promise<void> {
  if (link) {
    await AsyncStorage.setItem(STORAGE_PREFIX + activityId, JSON.stringify(link));
  } else {
    await AsyncStorage.removeItem(STORAGE_PREFIX + activityId);
  }
}

async function getDefaultCalendarId(): Promise<string | null> {
  if (Platform.OS === 'ios') {
    const defaultCalendar = await Calendar.getDefaultCalendarAsync();
    return defaultCalendar.id;
  }
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const writable = calendars.find((c) => c.allowsModifications);
  return writable?.id ?? null;
}

async function addActivityToAppleCalendarInternal(
  activity: CalendarActivityInfo,
): Promise<{ success: boolean; error?: string }> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== 'granted') return { success: false, error: 'Calendar permission denied' };

  const calendarId = await getDefaultCalendarId();
  if (!calendarId) return { success: false, error: 'No writable calendar found' };

  const endDate = new Date(activity.startsAt.getTime() + activity.durationMinutes * 60000);

  try {
    const eventId = await Calendar.createEventAsync(calendarId, {
      title: activity.title,
      startDate: activity.startsAt,
      endDate,
      location: activity.locationName,
      notes: `${activity.description}\n\n${activityDeepLink(activity.id)}`,
      timeZone: 'Asia/Jerusalem',
    });
    await setStoredLink(activity.id, {
      eventId,
      startTime: activity.startsAt.toISOString(),
      locationName: activity.locationName,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Could not add to calendar' };
  }
}

/** Coalesces rapid duplicate taps before the persisted calendar link exists. */
export function addActivityToAppleCalendar(
  activity: CalendarActivityInfo,
): Promise<{ success: boolean; error?: string }> {
  const running = inFlightAdds.get(activity.id);
  if (running) return running;
  const task = addActivityToAppleCalendarInternal(activity).finally(() => inFlightAdds.delete(activity.id));
  inFlightAdds.set(activity.id, task);
  return task;
}

export async function hasCalendarDrift(
  activity: CalendarActivityInfo,
): Promise<'none' | 'changed' | 'not_linked'> {
  const stored = await getStoredLink(activity.id);
  if (!stored) return 'not_linked';
  if (stored.startTime !== activity.startsAt.toISOString() || stored.locationName !== activity.locationName) {
    return 'changed';
  }
  return 'none';
}

export async function updateCalendarEvent(
  activity: CalendarActivityInfo,
): Promise<{ success: boolean; error?: string }> {
  const stored = await getStoredLink(activity.id);
  if (!stored) return addActivityToAppleCalendar(activity);

  const endDate = new Date(activity.startsAt.getTime() + activity.durationMinutes * 60000);
  try {
    await Calendar.updateEventAsync(stored.eventId, {
      title: activity.title,
      startDate: activity.startsAt,
      endDate,
      location: activity.locationName,
      notes: `${activity.description}\n\n${activityDeepLink(activity.id)}`,
      timeZone: 'Asia/Jerusalem',
    });
    await setStoredLink(activity.id, {
      eventId: stored.eventId,
      startTime: activity.startsAt.toISOString(),
      locationName: activity.locationName,
    });
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : 'Could not update calendar event' };
  }
}

export async function removeCalendarEvent(activityId: string): Promise<{ success: boolean }> {
  const stored = await getStoredLink(activityId);
  if (!stored) return { success: true };
  try {
    await Calendar.deleteEventAsync(stored.eventId);
  } catch {
    // Already removed by the user in their calendar app — treat as success either way.
  }
  await setStoredLink(activityId, null);
  return { success: true };
}

export async function isLinkedToCalendar(activityId: string): Promise<boolean> {
  return (await getStoredLink(activityId)) !== null;
}

// Re-exported from a dependency-free module (no expo-calendar/react-native
// imports) so it's directly unit-testable — see buildGoogleCalendarUrl.ts.
export { buildGoogleCalendarUrl } from '@/utils/buildGoogleCalendarUrl';
