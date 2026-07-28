import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Activity, ActivityCategory, ActivityStatus } from '@/types/activity';

export interface MyActivity extends Activity {
  role: 'hosting' | 'going';
}

interface ActivityRow {
  id: string;
  host_id: string;
  title: string;
  category: ActivityCategory;
  cover_image_url: string | null;
  status: ActivityStatus;
  start_time: string;
  duration_minutes: number;
  latitude: number;
  longitude: number;
  capacity: number | null;
  baby_min_age_months: number | null;
  baby_max_age_months: number | null;
}

interface UseMyActivitiesResult {
  upcoming: MyActivity[];
  past: MyActivity[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/** Everything a mother has hosted or joined, split into upcoming/past. Both
 *  roles reuse the same `ActivityCard` component the Discover feed already
 *  uses — just tagged with a "Hosting"/"Going" role. */
export function useMyActivities(): UseMyActivitiesResult {
  const [activities, setActivities] = useState<MyActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        setActivities([]);
        return;
      }

      const [{ data: hostedRows, error: hostedError }, { data: joinedRows, error: joinedError }] = await Promise.all(
        [
          supabase
            .from('activities')
            .select(
              'id, host_id, title, category, cover_image_url, status, start_time, duration_minutes, latitude, longitude, capacity, baby_min_age_months, baby_max_age_months',
            )
            .eq('host_id', userId),
          supabase
            .from('activity_attendees')
            .select(
              'activity:activities(id, host_id, title, category, cover_image_url, status, start_time, duration_minutes, latitude, longitude, capacity, baby_min_age_months, baby_max_age_months)',
            )
            .eq('user_id', userId)
            .in('status', ['going', 'attended']),
        ],
      );
      if (hostedError) throw hostedError;
      if (joinedError) throw joinedError;

      const hosted = (hostedRows ?? []) as ActivityRow[];
      const joined = (joinedRows ?? [])
        .map((row) => row.activity as unknown as ActivityRow | ActivityRow[] | null)
        .flatMap((a) => (Array.isArray(a) ? a : a ? [a] : []));

      const relevantIds = [...hosted, ...joined].map((a) => a.id);
      const attendeeCounts = new Map<string, number>();
      if (relevantIds.length > 0) {
        const { data: attendeeRows } = await supabase
          .from('activity_attendees')
          .select('activity_id')
          .in('activity_id', relevantIds)
          .in('status', ['going', 'attended']);
        for (const row of attendeeRows ?? []) {
          attendeeCounts.set(row.activity_id, (attendeeCounts.get(row.activity_id) ?? 0) + 1);
        }
      }

      const toMyActivity = (row: ActivityRow, role: MyActivity['role']): MyActivity => ({
        id: row.id,
        hostId: row.host_id,
        title: row.title,
        category: row.category,
        coverImageUrl: row.cover_image_url,
        status: row.status,
        startTime: row.start_time,
        durationMinutes: row.duration_minutes,
        distanceKm: 0,
        latitude: row.latitude,
        longitude: row.longitude,
        attendees: [],
        attendeeCount: attendeeCounts.get(row.id) ?? 0,
        capacity: row.capacity,
        babyMinAgeMonths: row.baby_min_age_months,
        babyMaxAgeMonths: row.baby_max_age_months,
        role,
      });

      const hostedIds = new Set(hosted.map((a) => a.id));
      const merged = [
        ...hosted.map((a) => toMyActivity(a, 'hosting')),
        ...joined.filter((a) => !hostedIds.has(a.id)).map((a) => toMyActivity(a, 'going')),
      ];
      merged.sort((a, b) => a.startTime.localeCompare(b.startTime));
      setActivities(merged);
    } catch (err) {
      console.log('[MyActivities] load failed', err instanceof Error ? err.message : err);
      setError("Couldn't load your activities.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const now = new Date().toISOString();
  const upcoming = activities.filter((a) => a.startTime >= now).sort((a, b) => a.startTime.localeCompare(b.startTime));
  const past = activities.filter((a) => a.startTime < now).sort((a, b) => b.startTime.localeCompare(a.startTime));

  return { upcoming, past, isLoading, error, refresh: load };
}
