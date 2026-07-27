import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ActivityDetail } from '@/types/activity';

export function useActivityRsvp(initial: ActivityDetail) {
  const [activity, setActivity] = useState(initial);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const join = useCallback(async () => {
    const isFull =
      activity.capacity !== null && activity.attendeeCount >= activity.capacity;
    const previous = activity;
    const nextStatus = isFull ? 'waitlisted' : 'going';

    setIsSubmitting(true);
    setActivity((current) => ({
      ...current,
      viewerStatus: nextStatus,
      attendeeCount: isFull ? current.attendeeCount : current.attendeeCount + 1,
    }));

    try {
      await persistRsvp(activity.id, nextStatus);
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
      await persistRsvp(activity.id, 'none');
    } catch {
      setActivity(previous);
    } finally {
      setIsSubmitting(false);
    }
  }, [activity]);

  return { activity, isSubmitting, join, leave };
}

async function persistRsvp(
  activityId: string,
  status: 'going' | 'waitlisted' | 'none',
): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Not signed in');

  if (status === 'none') {
    const { error } = await supabase
      .from('activity_attendees')
      .delete()
      .match({ activity_id: activityId, user_id: user.id });
    if (error) throw error;
    return;
  }

  const { error } = await supabase
    .from('activity_attendees')
    .upsert(
      { activity_id: activityId, user_id: user.id, status },
      { onConflict: 'activity_id,user_id' },
    );
  if (error) throw error;
}
