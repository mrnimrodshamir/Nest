import { useCallback, useEffect, useState } from 'react';
import type { Activity } from '@/types/activity';

/**
 * TODO(supabase): replace mockFetchNearby with a real query, e.g.
 *
 *   supabase.rpc('nearby_activities', { user_location, radius_miles })
 *     .select('*, host:profiles(*), attendees:activity_attendees(user:profiles(*))')
 *
 * The screen-facing interface (todayActivities / feedActivities / radiusExpanded)
 * should not need to change — only this hook's internals.
 */

const BASE_RADIUS_MILES = 2;
const EXPANDED_RADIUS_MILES = 8;

interface UseNearbyActivitiesResult {
  todayActivities: Activity[];
  feedActivities: Activity[];
  isRefreshing: boolean;
  radiusExpanded: boolean;
  locationLabel: string;
  refresh: () => void;
}

export function useNearbyActivities(): UseNearbyActivitiesResult {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [radiusExpanded, setRadiusExpanded] = useState(false);

  const load = useCallback(async () => {
    setIsRefreshing(true);

    let results = await mockFetchNearby(BASE_RADIUS_MILES);
    let expanded = false;

    // Cold-start safety net: silently widen the search before ever
    // surfacing an empty state to the person.
    if (results.length === 0) {
      results = await mockFetchNearby(EXPANDED_RADIUS_MILES);
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
    locationLabel: `Near Florentin, ${radiusExpanded ? EXPANDED_RADIUS_MILES : BASE_RADIUS_MILES}mi`,
    refresh: load,
  };
}

async function mockFetchNearby(_radiusMiles: number): Promise<Activity[]> {
  await new Promise((resolve) => setTimeout(resolve, 300));

  const now = Date.now();
  return [
    {
      id: '1',
      hostId: 'host-1',
      title: 'Stroller walk along the park',
      category: 'walks',
      coverImageUrl: null,
      startTime: new Date(now + 2 * 3600 * 1000).toISOString(),
      distanceMiles: 0.8,
      latitude: 32.0891,
      longitude: 34.7748,
      attendeeCount: 6,
      capacity: 10,
      attendees: [
        { id: 'a1', displayName: 'Maya', avatarUrl: null, avatarColor: '#8FB4C9' },
        { id: 'a2', displayName: 'Noa', avatarUrl: null, avatarColor: '#C9A876' },
        { id: 'a3', displayName: 'Lea', avatarUrl: null, avatarColor: '#7C9A82' },
      ],
    },
    {
      id: '2',
      hostId: 'host-2',
      title: 'Coffee and chat for new mothers',
      category: 'coffee',
      coverImageUrl: null,
      startTime: new Date(now + 4 * 3600 * 1000).toISOString(),
      distanceMiles: 1.2,
      latitude: 32.0812,
      longitude: 34.7801,
      attendeeCount: 3,
      capacity: 8,
      attendees: [
        { id: 'a4', displayName: 'Tal', avatarUrl: null, avatarColor: '#8FB4C9' },
        { id: 'a5', displayName: 'Shira', avatarUrl: null, avatarColor: '#C9A876' },
      ],
    },
  ];
}
