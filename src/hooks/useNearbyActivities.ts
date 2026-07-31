import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { supabase } from '@/lib/supabase';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { FALLBACK_LOCATION } from '@/constants/location';
import type { Activity, ActivityCategory, ActivityStatus, Attendee } from '@/types/activity';

const KM_PER_MILE = 1.60934;
const BASE_RADIUS_KM = 3;
const EXPANDED_RADIUS_KM = 13;

interface UseNearbyActivitiesResult {
  todayActivities: Activity[];
  feedActivities: Activity[];
  isRefreshing: boolean;
  radiusExpanded: boolean;
  locationLabel: string;
  locationDenied: boolean;
  isOffline: boolean;
  error: string | null;
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

interface UseNearbyActivitiesOptions {
  /** Dependency-injection escape hatch for UI preview builds — when set,
   *  the hook returns this data immediately and never touches location
   *  permissions, network status, or Supabase. Never set in production. */
  mockActivities?: Activity[];
}

export function useNearbyActivities(options?: UseNearbyActivitiesOptions): UseNearbyActivitiesResult {
  const [activities, setActivities] = useState<Activity[]>(options?.mockActivities ?? []);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [radiusExpanded, setRadiusExpanded] = useState(false);
  const [locationDenied, setLocationDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isOffline } = useNetworkStatus();
  const mockActivities = options?.mockActivities;

  const load = useCallback(async () => {
    if (mockActivities) {
      setActivities(mockActivities);
      return;
    }
    if (isOffline) {
      // Don't even attempt the round trip — surface the offline state
      // immediately rather than waiting on a request that will time out.
      setIsRefreshing(false);
      return;
    }

    setIsRefreshing(true);
    setError(null);

    try {
      const { coords, denied } = await resolveLocation();
      setLocationDenied(denied);

      let results = await fetchNearby(coords, BASE_RADIUS_KM);
      let expanded = false;

      // Cold-start safety net: silently widen the search before ever
      // surfacing an empty state to the person.
      if (results.length === 0) {
        results = await fetchNearby(coords, EXPANDED_RADIUS_KM);
        expanded = true;
      }

      setActivities(results);
      setRadiusExpanded(expanded);
    } catch (err) {
      setError(
        err instanceof Error
          ? "Couldn't load nearby activities. Please try again."
          : 'Something went wrong loading activities.',
      );
    } finally {
      setIsRefreshing(false);
    }
  }, [isOffline]);

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
    locationLabel: `Nearby, ${radiusExpanded ? EXPANDED_RADIUS_KM : BASE_RADIUS_KM}km`,
    locationDenied,
    isOffline,
    error,
    refresh: load,
  };
}

/** Only requests permission — does not block the feed if denied. Callers
 *  reaching Discover/the map is the first moment we ask, never at signup. */
async function resolveLocation(): Promise<{ coords: { latitude: number; longitude: number }; denied: boolean }> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') return { coords: FALLBACK_LOCATION, denied: true };

  try {
    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });
    return {
      coords: { latitude: position.coords.latitude, longitude: position.coords.longitude },
      denied: false,
    };
  } catch {
    return { coords: FALLBACK_LOCATION, denied: false };
  }
}

async function fetchNearby(
  coords: { latitude: number; longitude: number },
  radiusKm: number,
): Promise<Activity[]> {
  // The underlying RPC still speaks miles — convert only at this boundary
  // so the rest of the app (and the launch market's expected unit) is km.
  const { data: rows, error } = await supabase.rpc('nearby_activities', {
    user_lat: coords.latitude,
    user_lng: coords.longitude,
    radius_miles: radiusKm / KM_PER_MILE,
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
    // attendeeCount stays the raw row count (host included), matching
    // Activity Detail's convention; only the rendered avatar list excludes
    // the host, so the same activity's avatar set matches on both screens.
    const nonHostAttendees = attendees.filter((attendee) => attendee.id !== row.host_id);
    return {
      id: row.id,
      hostId: row.host_id,
      title: row.title,
      category: row.category,
      coverImageUrl: row.cover_image_url,
      status: row.status,
      startTime: row.start_time,
      durationMinutes: row.duration_minutes,
      distanceKm: row.distance_miles * KM_PER_MILE,
      latitude: row.latitude,
      longitude: row.longitude,
      attendeeCount: attendees.length,
      capacity: row.capacity,
      babyMinAgeMonths: row.baby_min_age_months,
      babyMaxAgeMonths: row.baby_max_age_months,
      attendees: nonHostAttendees.slice(0, 5),
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
