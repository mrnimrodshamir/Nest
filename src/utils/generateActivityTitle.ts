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

/** '' / ' tomorrow' / ' on Friday' — a natural-sentence fragment, not a
 *  bare day word, so it slots directly into "{category}{temporal} at
 *  {location}" without an awkward join. Today is left implicit (nobody
 *  says "coffee meetup today at Dizengoff Square" out loud). */
function temporalPhrase(date: Date, now: Date = new Date()): string {
  const day = relativeDayWord(date, now);
  if (day === 'Today') return '';
  if (day === 'Tomorrow') return ' tomorrow';
  return ` on ${day}`;
}

/** The part of a location name worth putting in a title — "HaYarkon Park,
 *  main entrance" becomes "HaYarkon Park", not the full address detail. */
function shortLocationLabel(locationName: string): string {
  const first = locationName.split(',')[0].trim();
  return first || locationName.trim();
}

/** Auto-generated activity title — a natural sentence built from data the
 *  host already entered, so creating an activity never requires typing a
 *  title by hand:
 *    "Coffee meetup at Dizengoff Square"
 *    "Stroller walk tomorrow at HaYarkon Park"
 *    "Yoga on Friday at Tel Aviv Port"
 *  Recomputed whenever type/date/location change, unless the host has
 *  intentionally customized it (see ActivityForm's `titleCustomized`
 *  state). Never falls back to a bare category word — even with no
 *  location picked yet, at minimum "{Category}{temporal}" still reads as
 *  a complete phrase ("Coffee meetup", "Stroller walk tomorrow"). */
export function generateActivityTitle(
  activityType: ActivityCategory,
  startsAt: Date,
  locationName: string,
  now: Date = new Date(),
): string {
  const category = CATEGORY_LABELS[activityType] ?? CATEGORY_LABELS.other;
  const temporal = temporalPhrase(startsAt, now);
  const location = shortLocationLabel(locationName);
  if (!location) return `${category}${temporal}`;
  return `${category}${temporal} at ${location}`;
}
