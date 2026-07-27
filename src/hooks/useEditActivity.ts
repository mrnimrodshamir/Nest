import { useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { CreateActivityInput } from '@/hooks/useCreateActivity';

export function useEditActivity(activityId: string) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = async (input: CreateActivityInput): Promise<boolean> => {
    setIsSubmitting(true);
    setError(null);
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
      })
      .eq('id', activityId);
    setIsSubmitting(false);
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

  return { isSubmitting, error, update, cancelActivity };
}
