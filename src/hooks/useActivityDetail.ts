import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import type { ActivityCategory, ActivityDetail, Attendee } from '@/types/activity';

interface UseActivityDetailResult {
  detail: ActivityDetail | null;
  isLoading: boolean;
  error: string | null;
}

interface ActivityRow {
  id: string;
  host_id: string;
  title: string;
  description: string | null;
  category: ActivityCategory;
  address_label: string;
  start_time: string;
  duration_minutes: number;
  capacity: number | null;
  cover_image_url: string | null;
  baby_min_age_months: number | null;
  baby_max_age_months: number | null;
  notes: string | null;
  latitude: number;
  longitude: number;
}

export function useActivityDetail(activityId: string): UseActivityDetailResult {
  const [detail, setDetail] = useState<ActivityDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    async function load() {
      const [{ data: activityRow, error: activityError }, { data: userData }] = await Promise.all([
        supabase.from('activities').select('*').eq('id', activityId).single<ActivityRow>(),
        supabase.auth.getUser(),
      ]);

      if (cancelled) return;
      if (activityError || !activityRow) {
        setError(activityError?.message ?? 'Activity not found');
        setIsLoading(false);
        return;
      }

      const [{ data: hostRow }, { data: attendeeRows }] = await Promise.all([
        supabase
          .from('public_profiles')
          .select('id, display_name, avatar_url, verified_at')
          .eq('id', activityRow.host_id)
          .single(),
        supabase
          .from('activity_attendees')
          .select('user_id, status, user:public_profiles(id, display_name, avatar_url)')
          .eq('activity_id', activityId)
          .in('status', ['going', 'attended']),
      ]);
      if (cancelled) return;

      const attendees: Attendee[] = (attendeeRows ?? []).flatMap((row) => {
        const rawProfile = row.user as unknown;
        const profile = (Array.isArray(rawProfile) ? rawProfile[0] : rawProfile) as
          | { id: string; display_name: string; avatar_url: string | null }
          | null
          | undefined;
        if (!profile) return [];
        return [
          {
            id: profile.id,
            displayName: profile.display_name,
            avatarUrl: profile.avatar_url,
            avatarColor: colorForId(profile.id),
          },
        ];
      });

      let viewerStatus: ActivityDetail['viewerStatus'] = 'none';
      const user = userData.user;
      if (user) {
        const { data: attendeeRow } = await supabase
          .from('activity_attendees')
          .select('status')
          .match({ activity_id: activityId, user_id: user.id })
          .maybeSingle();
        if (cancelled) return;
        if (attendeeRow?.status === 'going' || attendeeRow?.status === 'attended') {
          viewerStatus = 'going';
        } else if (attendeeRow?.status === 'waitlisted') {
          viewerStatus = 'waitlisted';
        }
      }

      const distanceMiles = await estimateDistanceMiles(activityRow.latitude, activityRow.longitude);
      if (cancelled) return;

      setDetail({
        id: activityRow.id,
        hostId: activityRow.host_id,
        title: activityRow.title,
        category: activityRow.category,
        coverImageUrl: activityRow.cover_image_url,
        startTime: activityRow.start_time,
        durationMinutes: activityRow.duration_minutes,
        distanceMiles,
        latitude: activityRow.latitude,
        longitude: activityRow.longitude,
        attendees: attendees.slice(0, 5),
        attendeeCount: attendees.length,
        capacity: activityRow.capacity,
        babyMinAgeMonths: activityRow.baby_min_age_months,
        babyMaxAgeMonths: activityRow.baby_max_age_months,
        description: activityRow.description ?? '',
        notes: activityRow.notes,
        location: {
          label: activityRow.address_label,
          latitude: activityRow.latitude,
          longitude: activityRow.longitude,
        },
        host: {
          id: activityRow.host_id,
          displayName: hostRow?.display_name ?? 'Host',
          avatarUrl: hostRow?.avatar_url ?? null,
          avatarColor: '#8FB4C9',
          verified: Boolean(hostRow?.verified_at),
          bio: null,
        },
        viewerStatus,
      });
      setIsLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [activityId]);

  return { detail, isLoading, error };
}

async function estimateDistanceMiles(lat: number, lng: number): Promise<number> {
  try {
    const { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') return 0;
    const position = await Location.getLastKnownPositionAsync();
    if (!position) return 0;
    return haversineMiles(position.coords.latitude, position.coords.longitude, lat, lng);
  } catch {
    return 0;
  }
}

function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 3958.8; // Earth radius in miles
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const PALETTE = ['#7C9A82', '#C9A876', '#8FB4C9', '#A8A69C'];

function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
