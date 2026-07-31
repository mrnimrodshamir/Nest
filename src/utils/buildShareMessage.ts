import { relativeDayWord } from './generateActivityTitle';
import { CATEGORY_LABELS } from '../types/activity';
import type { ActivityCategory, ActivityStatus } from '../types/activity';
import { APP_NAME } from '../constants/brand';

export interface ShareableActivity {
  id: string;
  title: string;
  category: ActivityCategory;
  startsAt: Date;
  locationName: string;
  durationMinutes: number;
  babyMinAgeMonths: number | null;
  babyMaxAgeMonths: number | null;
  /** Optional — when present and 'cancelled', the message reflects that
   *  instead of inviting people to a plan that no longer exists. Callers
   *  that only ever share live activities can omit this. */
  status?: ActivityStatus;
}

/** momzi:// deep link into a specific activity — see App.tsx's linking config. */
export function activityDeepLink(activityId: string): string {
  return `momzi://activity/${activityId}`;
}

/** A warm, natural sentence — never emoji-heavy or robotic — e.g. "Join us
 *  for a stroller walk tomorrow at 10:00 in HaYarkon Park. See the
 *  activity on Momzi." A missing location or category never breaks the
 *  message; a cancelled activity is never invited to as if still live. */
export function buildShareMessage(activity: ShareableActivity): string {
  if (activity.status === 'cancelled') {
    return [
      `This ${APP_NAME} activity has been cancelled: "${activity.title}".`,
      activityDeepLink(activity.id),
    ].join('\n');
  }

  const categoryLabel = (CATEGORY_LABELS[activity.category] ?? CATEGORY_LABELS.other).toLowerCase();
  const day = relativeDayWord(activity.startsAt);
  const dayPhrase = day === 'Today' || day === 'Tomorrow' ? day.toLowerCase() : day;
  const timeLabel = activity.startsAt
    .toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    .toLowerCase()
    .replace(' ', '');
  const locationPhrase = activity.locationName.trim() ? ` in ${activity.locationName.trim()}` : '';

  return [
    `Join us for a ${categoryLabel} ${dayPhrase} at ${timeLabel}${locationPhrase}. See the activity on ${APP_NAME}.`,
    activityDeepLink(activity.id),
  ].join('\n');
}
