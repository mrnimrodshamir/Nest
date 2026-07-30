import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { uploadActivityCover, type CoverUploadStage } from '@/lib/uploadActivityCover';
import { curatedCoverUrl } from '@/components/CuratedCover';
import { track } from '@/lib/analytics';
import type { ActivityCategory } from '@/types/activity';

export interface CreateActivityInput {
  activityType: ActivityCategory;
  title: string;
  description: string;
  startsAt: Date;
  durationMinutes: number;
  latitude: number;
  longitude: number;
  locationName: string;
  maxParticipants: number | null;
  babyMinAgeMonths: number | null;
  babyMaxAgeMonths: number | null;
  notes: string;
  /** Local file URI from the picker — takes priority over a curated cover. */
  coverUri: string | null;
  /** Set when the host chose a curated gradient instead of uploading. */
  curatedCover: ActivityCategory | null;
  /** Empty means the host is coming alone. */
  hostChildIds: string[];
}

export type CreateActivityStage = 'saving' | CoverUploadStage;

/** 'success': activity created and the host is confirmed in
 *  activity_attendees. 'partial': the activity row exists (real,
 *  recoverable — never deleted automatically) but joining the host to
 *  their own activity failed; the caller should keep the user on the
 *  form and offer retryHostJoin. 'error': the activity itself was never
 *  created. */
export type CreateActivityResult =
  | { status: 'success'; activityId: string }
  | { status: 'partial'; activityId: string; message: string }
  | { status: 'error'; message: string };

interface UseCreateActivityResult {
  isSubmitting: boolean;
  stage: CreateActivityStage | null;
  error: string | null;
  submit: (input: CreateActivityInput) => Promise<CreateActivityResult>;
  /** Retries only the host-join step for an activity that already exists —
   *  never re-creates the activity. Uses the same join_activity RPC as a
   *  regular participant join. */
  retryHostJoin: (activityId: string, hostChildIds: string[]) => Promise<boolean>;
}

export function useCreateActivity(): UseCreateActivityResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stage, setStage] = useState<CreateActivityStage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const joinAsHost = useCallback(async (activityId: string, hostChildIds: string[]) => {
    const { error: joinError } = await supabase.rpc('join_activity', {
      p_activity_id: activityId,
      p_child_ids: hostChildIds,
    });
    if (joinError) {
      console.log('[CreateActivity] Host auto-join failed', joinError.message);
      return false;
    }
    return true;
  }, []);

  const submit = useCallback(
    async (input: CreateActivityInput): Promise<CreateActivityResult> => {
      setIsSubmitting(true);
      setStage('saving');
      setError(null);

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError('Not signed in');
        setIsSubmitting(false);
        setStage(null);
        return { status: 'error', message: 'Not signed in' };
      }

      // The activity row needs to exist first — cover uploads are stored at
      // activity-covers/{activityId}/..., and RLS checks that path against
      // the activities table.
      const initialCoverUrl = input.curatedCover ? curatedCoverUrl(input.curatedCover) : null;

      const { data, error: insertError } = await supabase
        .from('activities')
        .insert({
          host_id: user.id,
          title: input.title,
          description: input.description,
          category: input.activityType,
          address_label: input.locationName,
          start_time: input.startsAt.toISOString(),
          duration_minutes: input.durationMinutes,
          latitude: input.latitude,
          longitude: input.longitude,
          capacity: input.maxParticipants,
          baby_min_age_months: input.babyMinAgeMonths,
          baby_max_age_months: input.babyMaxAgeMonths,
          notes: input.notes || null,
          cover_image_url: initialCoverUrl,
          host_coming_alone: input.hostChildIds.length === 0,
        })
        .select('id')
        .single();

      if (insertError) {
        console.log('[CreateActivity] Activity insert failed', insertError.message);
        const message = "Couldn't create your activity. Please try again.";
        setError(message);
        setIsSubmitting(false);
        setStage(null);
        return { status: 'error', message };
      }

      const activityId = data.id as string;

      // The activities_create_chat DB trigger has already created the group
      // chat and added the host to chat_participants as part of the same
      // insert transaction above — no separate client call needed for that.
      // What's still missing is the host's own activity_attendees row,
      // which join_activity (the same RPC a regular participant uses)
      // provides — capacity-checked, idempotent, and already guarded
      // against notifying the host about their own join.
      const joined = await joinAsHost(activityId, input.hostChildIds);

      if (input.coverUri) {
        try {
          const coverUrl = await uploadActivityCover(activityId, input.coverUri, setStage);
          await supabase.from('activities').update({ cover_image_url: coverUrl }).eq('id', activityId);
        } catch {
          // Cover upload is optional — the activity is already created with a
          // curated fallback (via CoverImage's category fallback) either way.
        }
      }

      track('activity_created', { activity_id: activityId, category: input.activityType });
      setIsSubmitting(false);
      setStage(null);

      if (!joined) {
        const message =
          "Your activity was created, but we couldn't complete your participation setup. Tap to retry.";
        setError(message);
        return { status: 'partial', activityId, message };
      }

      return { status: 'success', activityId };
    },
    [joinAsHost],
  );

  const retryHostJoin = useCallback(
    async (activityId: string, hostChildIds: string[]) => {
      setIsSubmitting(true);
      setError(null);
      const joined = await joinAsHost(activityId, hostChildIds);
      setIsSubmitting(false);
      if (!joined) {
        setError("Still couldn't complete your participation setup. Please try again.");
      }
      return joined;
    },
    [joinAsHost],
  );

  return { isSubmitting, stage, error, submit, retryHostJoin };
}
