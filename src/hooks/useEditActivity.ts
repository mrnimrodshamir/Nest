import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import { uploadActivityCover, type CoverUploadStage } from '@/lib/uploadActivityCover';
import type { CreateActivityInput } from '@/hooks/useCreateActivity';

export function useEditActivity(activityId: string) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stage, setStage] = useState<CoverUploadStage | 'saving' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const update = async (input: CreateActivityInput): Promise<boolean> => {
    setIsSubmitting(true);
    setStage('saving');
    setError(null);

    // A new local photo, if picked, replaces the cover; otherwise leave
    // cover_image_url untouched (null still auto-renders the category
    // illustration via CoverImage's fallbackCategory).
    let coverUpdate: { cover_image_url?: string } = {};
    if (input.coverUri) {
      try {
        const coverUrl = await uploadActivityCover(activityId, input.coverUri, setStage);
        coverUpdate = { cover_image_url: coverUrl };
      } catch {
        // Non-blocking — keep whatever cover the activity already had.
      }
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
        host_coming_alone: input.hostChildIds.length === 0,
        ...coverUpdate,
      })
      .eq('id', activityId);
    if (updateError) {
      console.log('[EditActivity] Activity update failed', updateError.message);
      setIsSubmitting(false);
      setStage(null);
      setError("Couldn't save your changes. Please try again.");
      return false;
    }

    // Replace the host's child selection wholesale — simpler and safer
    // than diffing, and this table is small (a handful of rows per
    // activity at most).
    await supabase.from('activity_host_children').delete().eq('activity_id', activityId);
    if (input.hostChildIds.length > 0) {
      const { error: childrenError } = await supabase.from('activity_host_children').insert(
        input.hostChildIds.map((childId) => ({ activity_id: activityId, child_id: childId })),
      );
      if (childrenError) console.log('[EditActivity] Saving host children failed', childrenError.message);
    }

    setIsSubmitting(false);
    setStage(null);
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
      console.log('[EditActivity] Cancel failed', cancelError.message);
      setError("Couldn't cancel this activity. Please try again.");
      return false;
    }
    return true;
  };

  return { isSubmitting, stage, error, update, cancelActivity };
}
