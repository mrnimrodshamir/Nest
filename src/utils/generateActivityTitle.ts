import { activeDateLocale, currentAppLocale, translate } from '@/i18n/core';
import { activityCategoryLabel, localizedPlaceName } from '@/i18n/taxonomy';
import { CATEGORY_LABELS, type ActivityCategory } from '../types/activity';
import { isGenericPlaceName } from './genericPlaceName';

/** "Today" / "Tomorrow" / "Friday" — the day-only building block shared by
 *  every place the app describes when something's happening in words. */
export function relativeDayWord(date: Date, now: Date = new Date()): string {
  const locale = currentAppLocale();
  const isSameDay = date.toDateString() === now.toDateString();
  if (isSameDay) return translate(locale, 'time.today');

  const tomorrow = new Date(now.getTime() + 86400000);
  if (date.toDateString() === tomorrow.toDateString()) return translate(locale, 'time.tomorrow');

  return date.toLocaleDateString(activeDateLocale(), { weekday: 'long' });
}

/** '' / ' tomorrow' / ' on Friday' — a natural-sentence fragment, not a
 *  bare day word, so it slots directly into "{category}{temporal} at
 *  {location}" without an awkward join. Today is left implicit (nobody
 *  says "coffee meetup today at Dizengoff Square" out loud). */
function temporalPhrase(date: Date, now: Date = new Date()): string {
  const locale = currentAppLocale();
  const day = relativeDayWord(date, now);
  if (date.toDateString() === now.toDateString()) return '';
  if (date.toDateString() === new Date(now.getTime() + 86400000).toDateString()) return translate(locale, 'activity.title.tomorrow');
  return translate(locale, 'activity.title.onDay', { day });
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
  const locale = currentAppLocale();
  const safeCategory: ActivityCategory = activityType in CATEGORY_LABELS ? activityType : 'other';
  const category = activityCategoryLabel(safeCategory, (key, params) => translate(locale, key, params));
  const temporal = temporalPhrase(startsAt, now);
  const shortLabel = shortLocationLabel(locationName);
  /* A dropped pin has no name worth putting in a title. Previously the stored
     English placeholder was interpolated verbatim, producing
     "טיול עגלות ב־Meeting point" on a Hebrew device. Falling through to the
     no-location template instead gives "טיול עגלות מחר", which is both correct
     Hebrew and better copy than any translation of the placeholder would be —
     and it means the placeholder can never reach a title in ANY language. */
  const location = isGenericPlaceName(shortLabel) ? '' : localizedPlaceName({ name: shortLabel }, locale);
  const when = temporal.trim();
  if (!location) return translate(locale, 'activity.title.withoutLocation', { category, when }).replace(/\s+/g, ' ').trim();
  return translate(locale, 'activity.title.withLocation', { category, when, location }).replace(/\s+/g, ' ').trim();
}
