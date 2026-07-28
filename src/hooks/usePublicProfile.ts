import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface PublicProfileData {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  /** Default child's name/age only -- never every child, never a birthdate. */
  childName: string | null;
  childAgeMonths: number | null;
  memberSince: string;
  hostedCount: number;
  joinedCount: number;
  /** Plain-language, computed per-viewer -- never a public stat. */
  sharedContext: string | null;
}

interface UsePublicProfileResult {
  profile: PublicProfileData | null;
  isLoading: boolean;
  error: string | null;
}

/** Everything shown on a Public Profile. Deliberately excludes phone,
 *  exact birthdate, every child (only the default one), and anything
 *  resembling a score, rank, or badge. */
export function usePublicProfile(userId: string | null): UsePublicProfileResult {
  const [profile, setProfile] = useState<PublicProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setIsLoading(false);
      return;
    }
    let cancelled = false;

    async function load() {
      setIsLoading(true);
      setError(null);
      try {
        const { data: userData } = await supabase.auth.getUser();
        const viewerId = userData.user?.id ?? null;

        const { data: row, error: profileError } = await supabase
          .from('public_profiles')
          .select('id, display_name, avatar_url, baby_name, baby_age_months, member_since')
          .eq('id', userId)
          .maybeSingle();
        if (profileError) throw profileError;
        if (!row) {
          if (!cancelled) setError('This member could not be found.');
          return;
        }

        // A direct RLS-scoped count would undercount for viewers who aren't
        // the profile owner or a shared activity's host (attendee rows on
        // past activities aren't visible to arbitrary viewers) -- this RPC
        // reads the same regardless of who's asking.
        const { data: countsRow, error: countsError } = await supabase
          .rpc('public_activity_counts', { target_user_id: userId })
          .maybeSingle();
        if (countsError) throw countsError;
        const counts = countsRow as { hosted_count: number; joined_count: number } | null;
        const hostedCount = counts?.hosted_count ?? 0;
        const joinedCount = counts?.joined_count ?? 0;

        let sharedContext: string | null = null;
        if (viewerId && viewerId !== userId) {
          const [{ data: viewerActivities }, { data: theirActivities }] = await Promise.all([
            supabase
              .from('activity_attendees')
              .select('activity_id, activities(title)')
              .eq('user_id', viewerId)
              .in('status', ['going', 'attended']),
            supabase
              .from('activity_attendees')
              .select('activity_id')
              .eq('user_id', userId)
              .in('status', ['going', 'attended']),
          ]);
          const theirActivityIds = new Set((theirActivities ?? []).map((a) => a.activity_id));
          const shared = (viewerActivities ?? []).find((a) => theirActivityIds.has(a.activity_id));
          if (shared) {
            const activity = shared.activities as unknown as { title: string } | { title: string }[] | null;
            const title = Array.isArray(activity) ? activity[0]?.title : activity?.title;
            if (title) sharedContext = `You're both going to ${title}`;
          }
        }

        if (!cancelled) {
          setProfile({
            id: row.id,
            displayName: row.display_name,
            avatarUrl: row.avatar_url,
            childName: row.baby_name,
            childAgeMonths: row.baby_age_months,
            memberSince: row.member_since,
            hostedCount: hostedCount ?? 0,
            joinedCount: joinedCount ?? 0,
            sharedContext,
          });
        }
      } catch (err) {
        console.log('[PublicProfile] load failed', err instanceof Error ? err.message : err);
        if (!cancelled) setError("Couldn't load this profile.");
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return { profile, isLoading, error };
}
