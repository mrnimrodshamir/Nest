import AsyncStorage from '@react-native-async-storage/async-storage';
// MUST be 'expo-calendar/legacy'. In Expo 57 the ROOT module's
// getDefaultCalendarAsync / getCalendarsAsync / createEventAsync /
// requestCalendarPermissionsAsync are deprecation stubs that throw
// unconditionally at runtime, so importing from 'expo-calendar' makes every
// Add-to-Calendar attempt fail. activityCalendar.ts already uses /legacy;
// this path was missed. See eventCalendarSource.test.ts.
import * as Calendar from 'expo-calendar/legacy';
import { Platform } from 'react-native';
import {
  eventCalendarNotes,
  validateCalendarEvent,
  type CalendarEventInfo,
} from '@/utils/eventCalendar';

const STORAGE_PREFIX = 'nestup.calendarEvent.event.';
const inFlight = new Map<string, Promise<{ success: boolean; error?: string }>>();

/** Mirrors activityCalendar.getDefaultCalendarId. The iOS system default is
 *  NOT necessarily writable — a subscribed holiday calendar or a delegated
 *  Google calendar can be the default — and getDefaultCalendarAsync itself
 *  throws on devices that expose no default at all. Both cases have to fall
 *  through to scanning for a genuinely writable calendar, otherwise adding an
 *  Event fails on devices where adding an Activity succeeds. */
async function writableCalendarId(): Promise<string | null> {
  if (Platform.OS === 'ios') {
    try {
      const defaultCalendar = await Calendar.getDefaultCalendarAsync();
      if (defaultCalendar.allowsModifications) return defaultCalendar.id;
    } catch {
      // Managed devices may not expose a writable system default.
    }
  }
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  return calendars.find((calendar) => calendar.allowsModifications)?.id ?? null;
}

async function add(event: CalendarEventInfo): Promise<{ success: boolean; error?: string }> {
  const invalid = validateCalendarEvent(event);
  if (invalid) return { success: false, error: invalid };
  const existing = await AsyncStorage.getItem(`${STORAGE_PREFIX}${event.occurrenceId}`);
  if (existing) return { success: true };
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  if (status !== 'granted') return { success: false, error: 'Calendar permission denied' };
  try {
    // Inside the try: enumerating calendars can itself fail, and a rejection
    // escaping here would bypass the {success:false} contract callers rely on.
    const calendarId = await writableCalendarId();
    if (!calendarId) return { success: false, error: 'No writable calendar found' };
    const eventId = await Calendar.createEventAsync(calendarId, {
      title: event.title,
      startDate: new Date(event.startsAt),
      endDate: new Date(event.endsAt!),
      location: event.locationName ?? undefined,
      notes: eventCalendarNotes(event),
      timeZone: 'Asia/Jerusalem',
    });
    await AsyncStorage.setItem(`${STORAGE_PREFIX}${event.occurrenceId}`, eventId);
    return { success: true };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Could not add to calendar' };
  }
}

/** Coalesces rapid duplicate taps and persists the created event identity. */
export function addEventToAppleCalendar(event: CalendarEventInfo): Promise<{ success: boolean; error?: string }> {
  const running = inFlight.get(event.occurrenceId);
  if (running) return running;
  const task = add(event).finally(() => inFlight.delete(event.occurrenceId));
  inFlight.set(event.occurrenceId, task);
  return task;
}
