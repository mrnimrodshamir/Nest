import { contentDeepLink } from '@/utils/contentSharing';

export interface CalendarEventInfo {
  occurrenceId: string;
  title: string;
  description: string | null;
  startsAt: string;
  endsAt: string | null;
  locationName: string | null;
  sourceUrl: string | null;
  status: 'scheduled' | 'cancelled' | 'postponed';
}

export function validateCalendarEvent(event: CalendarEventInfo): string | null {
  if (event.status === 'cancelled') return 'Cancelled events cannot be added to a calendar.';
  if (event.status === 'postponed') return 'Wait for a confirmed new time before adding this event.';
  const start = new Date(event.startsAt);
  const end = event.endsAt ? new Date(event.endsAt) : null;
  if (Number.isNaN(start.getTime())) return 'This event has an invalid start time.';
  if (!end || Number.isNaN(end.getTime()) || end <= start) return 'This event does not have a confirmed end time yet.';
  return null;
}

export function eventCalendarNotes(event: CalendarEventInfo): string {
  return [event.description?.trim(), event.sourceUrl, contentDeepLink('event', event.occurrenceId)]
    .filter(Boolean)
    .join('\n\n');
}

export function buildGoogleEventCalendarUrl(event: CalendarEventInfo): string | null {
  if (validateCalendarEvent(event)) return null;
  const toGoogleDate = (value: string) => new Date(value).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: event.title,
    dates: `${toGoogleDate(event.startsAt)}/${toGoogleDate(event.endsAt!)}`,
    details: eventCalendarNotes(event),
    location: event.locationName ?? '',
    ctz: 'Asia/Jerusalem',
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
