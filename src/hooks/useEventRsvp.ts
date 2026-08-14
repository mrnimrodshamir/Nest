import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { coerceParentRole, type ParentRole } from '@/utils/parentRole';
import { track } from '@/lib/analytics';

export interface EventAttendee {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  ageYears: number | null;
  parentRole: ParentRole;
  childCount: number;
  neighborhood: string | null;
}

interface UseEventRsvpResult {
  isGoing: boolean;
  attendeeCount: number;
  attendees: EventAttendee[];
  isLoading: boolean;
  /** Set while a join/leave is in flight, so the control can be disabled and
   *  a double tap cannot fire two writes. */
  isSaving: boolean;
  error: string | null;
  toggle: () => Promise<void>;
  refresh: () => Promise<void>;
}

/** NestUp RSVP for an external Event occurrence.
 *
 *  This is NestUp attendance only — it never registers anyone with the
 *  organiser, the venue or the municipality. The Event's own registration link
 *  is a separate action rendered separately.
 *
 *  The row's user_id is enforced by RLS against auth.uid(); the client id here
 *  is used only for local state, never as the security boundary. */
export function useEventRsvp(occurrenceId: string | null): UseEventRsvpResult {
  const [isGoing, setIsGoing] = useState(false);
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [attendeeCount, setAttendeeCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!occurrenceId) {
      setAttendees([]);
      setAttendeeCount(0);
      setIsGoing(false);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const viewerId = userData.user?.id ?? null;

      const { data: rows, error: rowsError } = await supabase
        .from('event_attendees')
        .select('user_id')
        .eq('event_occurrence_id', occurrenceId);
      if (rowsError) throw rowsError;

      const userIds = (rows ?? []).map((row) => row.user_id as string);
      setAttendeeCount(userIds.length);
      setIsGoing(viewerId != null && userIds.includes(viewerId));

      if (userIds.length === 0) {
        setAttendees([]);
        return;
      }
      // Names and avatars come from public_profiles, which enforces the
      // privacy contract — no email, phone, birthdate or coordinates.
      const { data: profiles } = await supabase
        .from('public_profiles')
        // Public, derived fields only. No email, phone, exact birthdate,
        // coordinates or exact address can enter the attendee surface.
        .select('id, display_name, avatar_url, age_years, parent_role, child_count, neighborhood_label')
        .in('id', userIds);
      setAttendees(
        (profiles ?? []).map((p) => ({
          userId: p.id as string,
          displayName: p.display_name as string,
          avatarUrl: (p.avatar_url as string | null) ?? null,
          ageYears: typeof p.age_years === 'number' ? p.age_years : null,
          parentRole: coerceParentRole(p.parent_role),
          childCount: typeof p.child_count === 'number' ? Math.max(0, p.child_count) : 0,
          neighborhood: (p.neighborhood_label as string | null) ?? null,
        })),
      );
    } catch (err) {
      console.log('[EventRsvp] load failed', err instanceof Error ? err.message : err);
      setError("Couldn't load who's going.");
    } finally {
      setIsLoading(false);
    }
  }, [occurrenceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggle = useCallback(async () => {
    if (!occurrenceId || isSaving) return;
    const wasGoing = isGoing;
    setIsSaving(true);
    setError(null);
    // Optimistic: the control flips immediately, and is reverted below if the
    // write fails, so the UI never sits in a pending-looking state.
    setIsGoing(!wasGoing);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const viewerId = userData.user?.id;
      if (!viewerId) throw new Error('not authenticated');

      if (wasGoing) {
        const { error: deleteError } = await supabase
          .from('event_attendees')
          .delete()
          .eq('event_occurrence_id', occurrenceId)
          .eq('user_id', viewerId);
        if (deleteError) throw deleteError;
        track('event_rsvp_left', { content_id: occurrenceId });
      } else {
        // upsert on the unique (occurrence, user) pair, so a retry or a double
        // tap that slips past isSaving still cannot create a second row.
        const { error: insertError } = await supabase
          .from('event_attendees')
          .upsert(
            { event_occurrence_id: occurrenceId, user_id: viewerId, status: 'going' },
            { onConflict: 'event_occurrence_id,user_id', ignoreDuplicates: true },
          );
        if (insertError) throw insertError;
        track('event_rsvp_joined', { content_id: occurrenceId });
      }
      await load();
    } catch (err) {
      console.log('[EventRsvp] toggle failed', err instanceof Error ? err.message : err);
      setIsGoing(wasGoing);
      setError("Couldn't update your RSVP.");
    } finally {
      setIsSaving(false);
    }
  }, [occurrenceId, isGoing, isSaving, load]);

  return {
    isGoing,
    attendeeCount,
    attendees,
    isLoading,
    isSaving,
    error,
    toggle,
    refresh: load,
  };
}
