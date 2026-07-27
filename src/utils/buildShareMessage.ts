import { formatDuration } from '@/utils/formatDuration';
import { formatAgeRange } from '@/utils/babyAge';
import { CATEGORY_EMOJI } from '@/types/activity';
import type { ActivityCategory } from '@/types/activity';

export interface ShareableActivity {
  id: string;
  title: string;
  category: ActivityCategory;
  startsAt: Date;
  locationName: string;
  durationMinutes: number;
  babyMinAgeMonths: number | null;
  babyMaxAgeMonths: number | null;
}

/** momzi:// deep link into a specific activity — see App.tsx's linking config. */
export function activityDeepLink(activityId: string): string {
  return `momzi://activity/${activityId}`;
}

export function buildShareMessage(activity: ShareableActivity): string {
  const dateLabel = activity.startsAt.toLocaleDateString(undefined, { weekday: 'long' });
  const timeLabel = activity.startsAt
    .toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    .toLowerCase();
  const ageLabel = formatAgeRange(activity.babyMinAgeMonths, activity.babyMaxAgeMonths);

  return [
    `${CATEGORY_EMOJI[activity.category]} ${activity.title}`,
    `📍 ${activity.locationName}`,
    `🕙 ${dateLabel} ${timeLabel} · ${formatDuration(activity.durationMinutes)}`,
    `👶 ${ageLabel}`,
    '',
    'Join us on Momzi.',
    activityDeepLink(activity.id),
  ].join('\n');
}
