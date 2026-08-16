import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { safeCaregiverDisplayName } from '@/utils/profileIdentity';
import { coerceParentRole, type ParentRole } from '@/utils/parentRole';
import { currentAppLocale, translate } from '@/i18n';

export interface PublicProfileData {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  /** ALL children, not just the default one. Names only -- the view never
   *  returns a birthdate, and ages arrive pre-coarsened (exact months under
   *  two years, floored to whole years above). */
  childNames: string[];
  childCount: number;
  childAgesMonths: Array<number | null>;
  /** Self-selected only; null renders as the neutral "Parent". */
  parentRole: ParentRole;
  /** Whole years, derived in the view. Null when unknown or implausible —
   *  the birthdate itself is never exposed. */
  ageYears: number | null;
  /** General area, never coordinates. */
  neighborhood: string | null;
  occupation: string | null;
  bio: string | null;
  memberSince: string;
  hostedCount: number;
  joinedCount: number;
  /** Plain-language, computed per-viewer -- never a public stat. */
  sharedActivityTitle: string | null;
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
          .select(
            // age_years only — the birthdate itself is not in the view and
            // must never be selected here.
            'id, display_name, avatar_url, member_since, neighborhood_label, bio, occupation, parent_role, age_years, child_count, child_names, child_ages_months',
          )
          .eq('id', userId)
          .maybeSingle();
        if (profileError) throw profileError;
        if (!row) {
          if (!cancelled) setError(translate(currentAppLocale(), 'profile.notFound'));
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

        let sharedActivityTitle: string | null = null;
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
            if (title) sharedActivityTitle = title;
          }
        }

        if (!cancelled) {
          setProfile({
            id: row.id,
            displayName: safeCaregiverDisplayName(row.display_name),
            avatarUrl: row.avatar_url,
            childNames: (row.child_names ?? []) as string[],
            childCount: row.child_count ?? 0,
            childAgesMonths: (row.child_ages_months ?? []) as Array<number | null>,
            parentRole: coerceParentRole(row.parent_role),
            ageYears: typeof row.age_years === 'number' ? row.age_years : null,
            neighborhood: row.neighborhood_label ?? null,
            occupation: row.occupation ?? null,
            bio: row.bio ?? null,
            memberSince: row.member_since,
            hostedCount: hostedCount ?? 0,
            joinedCount: joinedCount ?? 0,
            sharedActivityTitle,
          });
        }
      } catch (err) {
        console.log('[PublicProfile] load failed', err instanceof Error ? err.message : err);
        if (!cancelled) setError(translate(currentAppLocale(), 'error.profileLoad'));
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
