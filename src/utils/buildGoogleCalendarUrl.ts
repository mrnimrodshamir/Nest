import { activityDeepLink } from './buildShareMessage';

export interface CalendarUrlActivityInfo {
  id: string;
  title: string;
  description: string;
  startsAt: Date;
  durationMinutes: number;
  locationName: string;
}

/** Pure — no native module deps — so it's directly unit-testable and
 *  importable from activityCalendar.ts without pulling expo-calendar into
 *  every consumer. Builds a prefilled Google Calendar "render" URL rather
 *  than using the Google Calendar API, so no OAuth is needed; opening it
 *  shows a draft event the parent reviews and saves themselves, never a
 *  silent create. */
export function buildGoogleCalendarUrl(activity: CalendarUrlActivityInfo): string {
  const endDate = new Date(activity.startsAt.getTime() + activity.durationMinutes * 60000);
  const toGoogleDate = (d: Date) => d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: activity.title,
    dates: `${toGoogleDate(activity.startsAt)}/${toGoogleDate(endDate)}`,
    details: `${activity.description}\n\n${activityDeepLink(activity.id)}`,
    location: activity.locationName,
    ctz: 'Asia/Jerusalem',
  });

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
