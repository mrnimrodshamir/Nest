import { useCallback, useState } from 'react';
import { supabase } from '@/lib/supabase';
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
}

interface UseCreateActivityResult {
  isSubmitting: boolean;
  error: string | null;
  submit: (input: CreateActivityInput) => Promise<string | null>; // returns new activity id, or null on failure
}

export function useCreateActivity(): UseCreateActivityResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = useCallback(async (input: CreateActivityInput) => {
    setIsSubmitting(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError('Not signed in');
      setIsSubmitting(false);
      return null;
    }

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
      })
      .select('id')
      .single();

    setIsSubmitting(false);

    if (insertError) {
      setError(insertError.message);
      return null;
    }
    return data.id as string;
  }, []);

  return { isSubmitting, error, submit };
}
