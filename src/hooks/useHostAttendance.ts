import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/** The host's current "coming with" selection for one of their own
 *  activities — fetched separately from useActivityDetail (which doesn't
 *  need this for every viewer, only the host, only while editing). */
export function useHostAttendance(activityId: string): { childIds: string[]; isLoading: boolean } {
  const [childIds, setChildIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    supabase
      .from('activity_host_children')
      .select('child_id')
      .eq('activity_id', activityId)
      .then(({ data }) => {
        if (cancelled) return;
        setChildIds((data ?? []).map((row) => row.child_id as string));
        setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [activityId]);

  return { childIds, isLoading };
}
