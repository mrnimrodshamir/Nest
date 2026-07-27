import { useCallback, useState } from 'react';
import type { ActivityDetail } from '@/types/activity';

/**
 * TODO(supabase): swap the two mock calls below for real writes, e.g.
 *   supabase.from('activity_attendees').insert({ activity_id, user_id, status })
 *   supabase.from('activity_attendees').delete().match({ activity_id, user_id })
 * Optimistic update stays the same either way — revert on failure.
 */
export function useActivityRsvp(initial: ActivityDetail) {
  const [activity, setActivity] = useState(initial);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const join = useCallback(async () => {
    const isFull =
      activity.capacity !== null && activity.attendeeCount >= activity.capacity;
    const previous = activity;

    setIsSubmitting(true);
    setActivity((current) => ({
      ...current,
      viewerStatus: isFull ? 'waitlisted' : 'going',
      attendeeCount: isFull ? current.attendeeCount : current.attendeeCount + 1,
    }));

    try {
      await mockPersistRsvp(activity.id, isFull ? 'waitlisted' : 'going');
    } catch {
      setActivity(previous); // revert on failure
    } finally {
      setIsSubmitting(false);
    }
  }, [activity]);

  const leave = useCallback(async () => {
    const previous = activity;

    setIsSubmitting(true);
    setActivity((current) => ({
      ...current,
      viewerStatus: 'none',
      attendeeCount:
        previous.viewerStatus === 'going'
          ? Math.max(0, current.attendeeCount - 1)
          : current.attendeeCount,
    }));

    try {
      await mockPersistRsvp(activity.id, 'none');
    } catch {
      setActivity(previous);
    } finally {
      setIsSubmitting(false);
    }
  }, [activity]);

  return { activity, isSubmitting, join, leave };
}

async function mockPersistRsvp(_activityId: string, _status: string): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 250));
}
