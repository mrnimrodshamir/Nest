import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { uploadActivityCover, type CoverUploadStage } from '@/lib/uploadActivityCover';
import { curatedCoverUrl } from '@/components/CuratedCover';
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
}

export type CreateActivityStage = 'saving' | CoverUploadStage;

interface UseCreateActivityResult {
  isSubmitting: boolean;
  stage: CreateActivityStage | null;
  error: string | null;
  submit: (input: CreateActivityInput) => Promise<string | null>; // returns new activity id, or null on failure
}

export function useCreateActivity(): UseCreateActivityResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stage, setStage] = useState<CreateActivityStage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (input: CreateActivityInput) => {
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
      return null;
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
      })
      .select('id')
      .single();

    if (insertError) {
      setError(insertError.message);
      setIsSubmitting(false);
      setStage(null);
      return null;
    }

    const activityId = data.id as string;

    if (input.coverUri) {
      try {
        const coverUrl = await uploadActivityCover(activityId, input.coverUri, setStage);
        await supabase.from('activities').update({ cover_image_url: coverUrl }).eq('id', activityId);
      } catch {
        // Cover upload is optional — the activity is already created with a
        // curated fallback (via CoverImage's category fallback) either way.
      }
    }

    setIsSubmitting(false);
    setStage(null);
    return activityId;
  }, []);

  return { isSubmitting, stage, error, submit };
}
