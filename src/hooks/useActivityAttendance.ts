import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { birthdateToMonths, formatBabyAge } from '@/utils/babyAge';

interface AttendanceRow {
  source: 'host' | 'attendee';
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  coming_alone: boolean;
  child_id: string | null;
  child_name: string | null;
  child_birthdate: string | null;
}

export interface PersonAttendance {
  userId: string;
  comingAlone: boolean;
  /** Privacy-approved copy: "coming alone" / "Maya, 4 months" / "two children". */
  summary: string;
}

/** "Who's coming with whom" for an activity — one summary string per
 *  person (host included), built from get_activity_attendance(). Shows
 *  first name + age for a single child, and a headcount-only phrase for
 *  multiple (matches the agreed privacy model: never expose every
 *  attending family's full child roster in one glance). */
export function useActivityAttendance(activityId: string): Record<string, PersonAttendance> {
  const [byUser, setByUser] = useState<Record<string, PersonAttendance>>({});

  useEffect(() => {
    let cancelled = false;
    supabase
      .rpc('get_activity_attendance', { p_activity_id: activityId })
      .then(({ data, error }) => {
        if (cancelled || error || !data) return;
        const rows = data as AttendanceRow[];
        const byUserRows = new Map<string, AttendanceRow[]>();
        for (const row of rows) {
          const list = byUserRows.get(row.user_id) ?? [];
          list.push(row);
          byUserRows.set(row.user_id, list);
        }

        const result: Record<string, PersonAttendance> = {};
        for (const [userId, personRows] of byUserRows) {
          const comingAlone = personRows[0]?.coming_alone ?? true;
          const childRows = personRows.filter((r) => r.child_id);
          result[userId] = {
            userId,
            comingAlone,
            summary: summarize(comingAlone, childRows),
          };
        }
        setByUser(result);
      });
    return () => {
      cancelled = true;
    };
  }, [activityId]);

  return byUser;
}

function summarize(comingAlone: boolean, childRows: AttendanceRow[]): string {
  if (comingAlone || childRows.length === 0) return 'coming alone';
  if (childRows.length === 1) {
    const row = childRows[0];
    const age = row.child_birthdate ? formatBabyAge(birthdateToMonths(row.child_birthdate)) : null;
    return age ? `coming with ${row.child_name}, ${age}` : `coming with ${row.child_name}`;
  }
  return `coming with ${childRows.length} children`;
}
