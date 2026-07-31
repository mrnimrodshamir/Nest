import { CATEGORY_LABELS } from '../types/activity';
import type { ActivityCategory } from '../types/activity';

/** "Today" / "Tomorrow" / "Friday" — the day-only building block shared by
 *  every place the app describes when something's happening in words. */
export function relativeDayWord(date: Date, now: Date = new Date()): string {
  const isSameDay = date.toDateString() === now.toDateString();
  if (isSameDay) return 'Today';

  const tomorrow = new Date(now.getTime() + 86400000);
  if (date.toDateString() === tomorrow.toDateString()) return 'Tomorrow';

  return date.toLocaleDateString(undefined, { weekday: 'long' });
}

/** "Today" / "Tomorrow" / "Friday morning" — adds a daypart once a date is
 *  far enough out that a bare weekday alone reads as ambiguous. */
function dateLabel(date: Date, now: Date = new Date()): string {
  const day = relativeDayWord(date, now);
  if (day === 'Today' || day === 'Tomorrow') return day;
  const hour = date.getHours();
  const daypart = hour < 12 ? 'morning' : hour < 17 ? 'afternoon' : 'evening';
  return `${day} ${daypart}`;
}

/** The part of a location name worth putting in a title — "HaYarkon Park,
 *  main entrance" becomes "HaYarkon Park", not the full address detail. */
function shortLocationLabel(locationName: string): string {
  const first = locationName.split(',')[0].trim();
  return first || locationName.trim();
}

/** Auto-generated activity title — "Stroller walk · Tomorrow · Yarkon Park" —
 *  built from data the host already entered, so creating an activity never
 *  requires typing a title by hand. Recomputed whenever type/date/location
 *  change, unless the host has intentionally customized it (see
 *  ActivityForm's `titleCustomized` state). */
export function generateActivityTitle(
  activityType: ActivityCategory,
  startsAt: Date,
  locationName: string,
): string {
  const parts = [CATEGORY_LABELS[activityType], dateLabel(startsAt)];
  const location = shortLocationLabel(locationName);
  if (location) parts.push(location);
  return parts.join(' · ');
}
