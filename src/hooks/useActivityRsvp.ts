import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import type { ActivityDetail } from '@/types/activity';

export function useActivityRsvp(initial: ActivityDetail, onSettled?: () => void) {
  const [activity, setActivity] = useState(initial);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // `initial` is a new object every time the parent's useActivityDetail
  // reloads (edit save, focus refresh, or a reconciling refresh right after
  // this hook's own join/leave call) — resync so the authoritative
  // server-side attendeeCount/status/viewerStatus always wins over whatever
  // this hook optimistically guessed.
  useEffect(() => {
    setActivity(initial);
  }, [initial]);

  const join = useCallback(async (childIds: string[] = []) => {
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
      p_child_ids: childIds,
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
    track('activity_joined', { activity_id: activity.id });
    onSettled?.();
    return true;
  }, [activity, onSettled]);

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
    } else {
      onSettled?.();
    }
  }, [activity, onSettled]);

  return { activity, isSubmitting, error, join, leave };
}
