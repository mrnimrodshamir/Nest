import type { ActivityDetail } from '@/types/activity';
import type { ActivityFormSeedValues } from '@/components/ActivityForm';
import type { ActivityLifecycle } from '@/utils/activityLifecycle';

export function canCreateAgain(isHost: boolean, lifecycle: ActivityLifecycle): boolean {
  return isHost && lifecycle === 'completed';
}

/** The allow-list is intentional: identity, lifecycle, participants,
 * attendance, chats, messages, timestamps and child ids cannot leak into a
 * new activity because they are not representable in this seed type. */
export function buildCreateAgainSeed(activity: ActivityDetail): ActivityFormSeedValues {
  return {
    activityType: activity.category,
    description: activity.description,
    durationMinutes: activity.durationMinutes,
    latitude: activity.location.latitude,
    longitude: activity.location.longitude,
    locationName: activity.location.label,
    ...(activity.location.selection ? { selectedLocation: activity.location.selection } : {}),
    maxParticipants: activity.capacity,
    babyMinAgeMonths: activity.babyMinAgeMonths,
    babyMaxAgeMonths: activity.babyMaxAgeMonths,
    notes: activity.notes ?? '',
    coverImageUrl: activity.coverImageUrl,
  };
}
