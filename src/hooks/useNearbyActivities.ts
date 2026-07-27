import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import type { Activity, ActivityCategory, ActivityStatus, Attendee } from '@/types/activity';

const BASE_RADIUS_MILES = 2;
const EXPANDED_RADIUS_MILES = 8;

// Used only if location permission is denied — keeps the feed usable rather
// than dead-ending on a blank map.
const FALLBACK_LOCATION = { latitude: 32.0853, longitude: 34.7818 };

interface UseNearbyActivitiesResult {
  todayActivities: Activity[];
  feedActivities: Activity[];
  isRefreshing: boolean;
  radiusExpanded: boolean;
  locationLabel: string;
  refresh: () => void;
}

interface NearbyActivityRow {
  id: string;
  host_id: string;
  title: string;
  category: ActivityCategory;
  cover_image_url: string | null;
  status: ActivityStatus;
  start_time: string;
  duration_minutes: number;
  capacity: number | null;
  baby_min_age_months: number | null;
  baby_max_age_months: number | null;
  latitude: number;
  longitude: number;
  distance_miles: number;
}

export function useNearbyActivities(): UseNearbyActivitiesResult {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [radiusExpanded, setRadiusExpanded] = useState(false);

  const load = useCallback(async () => {
    setIsRefreshing(true);

    const coords = await resolveLocation();

    let results = await fetchNearby(coords, BASE_RADIUS_MILES);
    let expanded = false;

    // Cold-start safety net: silently widen the search before ever
    // surfacing an empty state to the person.
    if (results.length === 0) {
      results = await fetchNearby(coords, EXPANDED_RADIUS_MILES);
      expanded = true;
    }

    setActivities(results);
    setRadiusExpanded(expanded);
    setIsRefreshing(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const now = new Date();
  const todayActivities = activities.filter(
    (a) => new Date(a.startTime).toDateString() === now.toDateString(),
  );
  const feedActivities = activities;

  return {
    todayActivities,
    feedActivities,
    isRefreshing,
    radiusExpanded,
    locationLabel: `Nearby, ${radiusExpanded ? EXPANDED_RADIUS_MILES : BASE_RADIUS_MILES}mi`,
    refresh: load,
  };
}

/** Only requests permission — does not block the feed if denied. Callers
 *  reaching Discover/the map is the first moment we ask, never at signup. */
async function resolveLocation(): Promise<{ latitude: number; longitude: number }> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return FALLBACK_LOCATION;

  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return { latitude: position.coords.latitude, longitude: position.coords.longitude };
  } catch {
    return FALLBACK_LOCATION;
  }
}

async function fetchNearby(
  coords: { latitude: number; longitude: number },
  radiusMiles: number,
): Promise<Activity[]> {
  const { data: rows, error } = await supabase.rpc('nearby_activities', {
    user_lat: coords.latitude,
    user_lng: coords.longitude,
    radius_miles: radiusMiles,
  });
  if (error) throw error;

  const activityRows = (rows ?? []) as NearbyActivityRow[];
  if (activityRows.length === 0) return [];

  const activityIds = activityRows.map((row) => row.id);

  const { data: attendeeRows, error: attendeeError } = await supabase
    .from('activity_attendees')
    .select('activity_id, status, user:public_profiles(id, display_name, avatar_url)')
    .in('activity_id', activityIds)
    .in('status', ['going', 'attended']);
  if (attendeeError) throw attendeeError;

  const attendeesByActivity = new Map<string, Attendee[]>();
  for (const row of attendeeRows ?? []) {
    const rawProfile = row.user as unknown;
    const profile = (Array.isArray(rawProfile) ? rawProfile[0] : rawProfile) as
      | { id: string; display_name: string; avatar_url: string | null }
      | null
      | undefined;
    if (!profile) continue;
    const list = attendeesByActivity.get(row.activity_id) ?? [];
    list.push({
      id: profile.id,
      displayName: profile.display_name,
      avatarUrl: profile.avatar_url,
      avatarColor: colorForId(profile.id),
    });
    attendeesByActivity.set(row.activity_id, list);
  }

  return activityRows.map((row) => {
    const attendees = attendeesByActivity.get(row.id) ?? [];
    return {
      id: row.id,
      hostId: row.host_id,
      title: row.title,
      category: row.category,
      coverImageUrl: row.cover_image_url,
      status: row.status,
      startTime: row.start_time,
      durationMinutes: row.duration_minutes,
      distanceMiles: row.distance_miles,
      latitude: row.latitude,
      longitude: row.longitude,
      attendeeCount: attendees.length,
      capacity: row.capacity,
      babyMinAgeMonths: row.baby_min_age_months,
      babyMaxAgeMonths: row.baby_max_age_months,
      attendees: attendees.slice(0, 5),
    };
  });
}

const PALETTE = ['#7C9A82', '#C9A876', '#8FB4C9', '#A8A69C'];

/** Deterministic accent color per person so avatars stay visually stable
 *  across refreshes without needing a stored color column. */
function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}
