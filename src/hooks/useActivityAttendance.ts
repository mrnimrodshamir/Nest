import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import {
  groupAttendance,
  type AttendanceRow,
  type PersonAttendance,
} from '@/utils/attendanceSummary';

export type { PersonAttendance } from '@/utils/attendanceSummary';

export interface AttendanceState {
  people: PersonAttendance[];
  /** Keyed by user id — preserves the previous map-shaped API used by the
   *  "who's coming with whom" line on Activity Detail. */
  byUser: Record<string, PersonAttendance>;
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

/** Attendance for an activity, grouped one entry per person with the host
 *  first. Built from get_activity_attendance(), which returns one row per
 *  (person x child) and a PRE-COARSENED child age — never a birthdate.
 *
 *  `refreshKey` lets Activity Detail force a refetch after a join or leave
 *  so the participants list and counts reflect the change immediately. */
export function useActivityAttendance(activityId: string, refreshKey = 0): AttendanceState {
  const [people, setPeople] = useState<PersonAttendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manualKey, setManualKey] = useState(0);

  const refresh = useCallback(() => setManualKey((k) => k + 1), []);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    supabase
      .rpc('get_activity_attendance', { p_activity_id: activityId })
      .then(({ data, error: rpcError }) => {
        if (cancelled) return;
        setIsLoading(false);
        if (rpcError) {
          setError("Couldn't load participants.");
          return;
        }
        setPeople(groupAttendance((data ?? []) as AttendanceRow[]));
      });

    return () => {
      cancelled = true;
    };
  }, [activityId, refreshKey, manualKey]);

  const byUser: Record<string, PersonAttendance> = {};
  for (const person of people) byUser[person.userId] = person;

  return { people, byUser, isLoading, error, refresh };
}
