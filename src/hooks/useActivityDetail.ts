import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { Activity, ActivityDetail } from '@/types/activity';

interface UseActivityDetailResult {
  detail: ActivityDetail;
  isLoading: boolean;
}

export function useActivityDetail(activity: Activity): UseActivityDetailResult {
  const [detail, setDetail] = useState<ActivityDetail>(() => placeholderDetail(activity));
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      const [{ data: activityRow, error: activityError }, { data: hostRow }, { data: userData }] =
        await Promise.all([
          supabase
            .from('activities')
            .select('description, address_label')
            .eq('id', activity.id)
            .single(),
          supabase
            .from('profiles')
            .select('id, display_name, avatar_url, bio, verified_at')
            .eq('id', activity.hostId)
            .single(),
          supabase.auth.getUser(),
        ]);

      if (cancelled) return;
      if (activityError) {
        setIsLoading(false);
        return;
      }

      let viewerStatus: ActivityDetail['viewerStatus'] = 'none';
      const user = userData.user;
      if (user) {
        const { data: attendeeRow } = await supabase
          .from('activity_attendees')
          .select('status')
          .match({ activity_id: activity.id, user_id: user.id })
          .maybeSingle();
        if (cancelled) return;
        if (attendeeRow?.status === 'going' || attendeeRow?.status === 'attended') {
          viewerStatus = 'going';
        } else if (attendeeRow?.status === 'waitlisted') {
          viewerStatus = 'waitlisted';
        }
      }

      setDetail({
        ...activity,
        description: activityRow?.description ?? '',
        location: {
          label: activityRow?.address_label ?? 'Location details unavailable',
          latitude: activity.latitude,
          longitude: activity.longitude,
        },
        host: {
          id: activity.hostId,
          displayName: hostRow?.display_name ?? 'Host',
          avatarUrl: hostRow?.avatar_url ?? null,
          avatarColor: '#8FB4C9',
          verified: Boolean(hostRow?.verified_at),
          bio: hostRow?.bio ?? null,
        },
        viewerStatus,
      });
      setIsLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [activity]);

  return { detail, isLoading };
}

function placeholderDetail(activity: Activity): ActivityDetail {
  return {
    ...activity,
    description: '',
    location: {
      label: 'Loading location…',
      latitude: activity.latitude,
      longitude: activity.longitude,
    },
    host: {
      id: activity.hostId,
      displayName: 'Host',
      avatarUrl: null,
      avatarColor: '#8FB4C9',
      verified: false,
      bio: null,
    },
    viewerStatus: 'none',
  };
}
