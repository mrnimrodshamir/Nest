import { formatDuration } from '@/utils/formatDuration';

export interface ShareableActivity {
  id: string;
  title: string;
  startsAt: Date;
  locationName: string;
  durationMinutes: number;
}

/** momzi:// deep link into a specific activity — see App.tsx's linking config. */
export function activityDeepLink(activityId: string): string {
  return `momzi://activity/${activityId}`;
}

export function buildShareMessage(activity: ShareableActivity): string {
  const dateLabel = activity.startsAt.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
  const timeLabel = activity.startsAt
    .toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    .toLowerCase();

  return (
    `I created "${activity.title}" for moms and babies this ${dateLabel} at ${timeLabel} ` +
    `(${formatDuration(activity.durationMinutes)}) near ${activity.locationName}. ` +
    `Join us on Monzy!\n${activityDeepLink(activity.id)}`
  );
}
