import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Calendar from 'expo-calendar';
import { Platform } from 'react-native';
import {
  eventCalendarNotes,
  validateCalendarEvent,
  type CalendarEventInfo,
} from '@/utils/eventCalendar';

const STORAGE_PREFIX = 'nestup.calendarEvent.event.';
const inFlight = new Map<string, Promise<{ success: boolean; error?: string }>>();

async function writableCalendarId(): Promise<string | null> {
  if (Platform.OS === 'ios') return (await Calendar.getDefaultCalendarAsync()).id;
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
  const calendarId = await writableCalendarId();
  if (!calendarId) return { success: false, error: 'No writable calendar found' };
  try {
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
