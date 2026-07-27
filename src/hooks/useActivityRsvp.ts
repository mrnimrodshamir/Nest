import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ActivityDetail } from '@/types/activity';

export function useActivityRsvp(initial: ActivityDetail) {
  const [activity, setActivity] = useState(initial);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = useCallback(async () => {
    const previous = activity;
    setError(null);
    setIsSubmitting(true);
    // Optimistic — the join_activity() RPC is the source of truth and will
    // reject (revert below) if someone else took the last spot first.
    setActivity((current) => ({
      ...current,
      viewerStatus: 'going',
      attendeeCount: current.attendeeCount + 1,
      status:
        current.capacity !== null && current.attendeeCount + 1 >= current.capacity
          ? 'full'
          : current.status,
    }));

    const { error: rpcError } = await supabase.rpc('join_activity', {
      p_activity_id: activity.id,
    });

    setIsSubmitting(false);
    if (rpcError) {
      setActivity(previous);
      setError(
        rpcError.message.includes('full')
          ? "This activity just filled up — you're a little late!"
          : "Couldn't join right now — please try again.",
      );
      return false;
    }
    return true;
  }, [activity]);

  const leave = useCallback(async () => {
    const previous = activity;
    setError(null);
    setIsSubmitting(true);
    setActivity((current) => ({
      ...current,
      viewerStatus: 'none',
      attendeeCount: Math.max(0, current.attendeeCount - 1),
      status: current.status === 'full' ? 'published' : current.status,
    }));

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const { error: deleteError } = user
      ? await supabase
          .from('activity_attendees')
          .delete()
          .match({ activity_id: activity.id, user_id: user.id })
      : { error: new Error('Not signed in') };

    setIsSubmitting(false);
    if (deleteError) {
      setActivity(previous);
      setError("Couldn't leave right now — please try again.");
    }
  }, [activity]);

  return { activity, isSubmitting, error, join, leave };
}
