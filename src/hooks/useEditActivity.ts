import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { uploadActivityCover, type CoverUploadStage } from '@/lib/uploadActivityCover';
import { curatedCoverUrl } from '@/components/CuratedCover';
import type { CreateActivityInput } from '@/hooks/useCreateActivity';

export function useEditActivity(activityId: string) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stage, setStage] = useState<CoverUploadStage | 'saving' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const update = async (input: CreateActivityInput): Promise<boolean> => {
    setIsSubmitting(true);
    setStage('saving');
    setError(null);

    // A new local photo takes priority; otherwise a curated pick updates
    // the cover; if neither changed, leave cover_image_url untouched.
    let coverUpdate: { cover_image_url?: string } = {};
    if (input.coverUri) {
      try {
        const coverUrl = await uploadActivityCover(activityId, input.coverUri, setStage);
        coverUpdate = { cover_image_url: coverUrl };
      } catch {
        // Non-blocking — keep whatever cover the activity already had.
      }
    } else if (input.curatedCover) {
      coverUpdate = { cover_image_url: curatedCoverUrl(input.curatedCover) };
    }

    setStage('saving');
    const { error: updateError } = await supabase
      .from('activities')
      .update({
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
        ...coverUpdate,
      })
      .eq('id', activityId);
    setIsSubmitting(false);
    setStage(null);
    if (updateError) {
      setError(updateError.message);
      return false;
    }
    return true;
  };

  const cancelActivity = async (): Promise<boolean> => {
    setIsSubmitting(true);
    setError(null);
    const { error: cancelError } = await supabase
      .from('activities')
      .update({ status: 'cancelled' })
      .eq('id', activityId);
    setIsSubmitting(false);
    if (cancelError) {
      setError(cancelError.message);
      return false;
    }
    return true;
  };

  return { isSubmitting, stage, error, update, cancelActivity };
}
