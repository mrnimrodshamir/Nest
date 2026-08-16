import { relativeDayWord } from './generateActivityTitle';
import type { ActivityCategory, ActivityStatus } from '../types/activity';
import { APP_NAME } from '../constants/brand';
import { activeDateLocale, currentAppLocale, translate } from '@/i18n/core';

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

/** nestup:// deep link into a specific activity — see App.tsx's linking config. */
export function activityDeepLink(activityId: string): string {
  if (!activityId?.trim()) return '';
  try {
    return `nestup://activity/${encodeURIComponent(activityId)}`;
  } catch {
    return '';
  }
}

/** A warm, natural sentence — never emoji-heavy or robotic — e.g. "Join us
 *  for a stroller walk tomorrow at 10:00 in HaYarkon Park. See the
 *  activity on NestUp." A missing location or category never breaks the
 *  message; a cancelled activity is never invited to as if still live. */
export function buildShareMessage(activity: ShareableActivity): string {
  const locale = currentAppLocale();
  const deepLink = activityDeepLink(activity.id);
  if (activity.status === 'cancelled') {
    return [
      translate(locale, 'sharing.activityCancelled', { title: activity.title }),
      ...(deepLink ? ['', translate(locale, 'sharing.openIn', { appName: APP_NAME }), deepLink] : []),
    ].join('\n');
  }

  const day = relativeDayWord(activity.startsAt);
  const timeLabel = activity.startsAt
    .toLocaleTimeString(activeDateLocale(), { hour: 'numeric', minute: '2-digit' })
    .replace(' ', '');
  const location = activity.locationName.trim();
  const invitation = location && !['selected meeting point', 'meeting point'].includes(location.toLocaleLowerCase())
    ? translate(locale, 'sharing.joinAt', { location })
    : translate(locale, 'sharing.joinFor', { title: activity.title.trim() });

  return [
    invitation,
    translate(locale, 'sharing.dayAt', { day, time: timeLabel }),
    ...(deepLink ? ['', translate(locale, 'sharing.openIn', { appName: APP_NAME }), deepLink] : []),
  ].join('\n');
}
