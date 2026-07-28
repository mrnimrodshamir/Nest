import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';

interface ReportInput {
  reportedUserId: string;
  activityId?: string;
  reason: string;
}

interface UseReportAndBlockResult {
  submitReport: (input: ReportInput) => Promise<string | null>;
  blockUser: (userId: string) => Promise<string | null>;
  unblockUser: (userId: string) => Promise<string | null>;
  isBlocked: (userId: string) => Promise<boolean>;
}

/** Thin wrapper over the `reports`/`blocks` tables — both already existed
 *  in the schema with correct RLS; this is the first client code to use
 *  them. Kept deliberately small: no moderation UI, no report history view,
 *  just the two actions a user actually needs. */
export function useReportAndBlock(): UseReportAndBlockResult {
  const submitReport = useCallback(async (input: ReportInput) => {
    const { data: userData } = await supabase.auth.getUser();
    const reporterId = userData.user?.id;
    if (!reporterId) return 'Not signed in.';
    const { error } = await supabase.from('reports').insert({
      reporter_id: reporterId,
      reported_user_id: input.reportedUserId,
      activity_id: input.activityId ?? null,
      reason: input.reason,
    });
    if (error) console.log('[ReportAndBlock] report failed', error.message);
    return error ? "Couldn't send your report. Please try again." : null;
  }, []);

  const blockUser = useCallback(async (userId: string) => {
    const { data: userData } = await supabase.auth.getUser();
    const blockerId = userData.user?.id;
    if (!blockerId) return 'Not signed in.';
    const { error } = await supabase.from('blocks').insert({ blocker_id: blockerId, blocked_id: userId });
    if (error) console.log('[ReportAndBlock] block failed', error.message);
    return error ? "Couldn't block this person. Please try again." : null;
  }, []);

  const unblockUser = useCallback(async (userId: string) => {
    const { data: userData } = await supabase.auth.getUser();
    const blockerId = userData.user?.id;
    if (!blockerId) return 'Not signed in.';
    const { error } = await supabase.from('blocks').delete().match({ blocker_id: blockerId, blocked_id: userId });
    if (error) console.log('[ReportAndBlock] unblock failed', error.message);
    return error ? "Couldn't unblock this person. Please try again." : null;
  }, []);

  const isBlocked = useCallback(async (userId: string) => {
    const { data: userData } = await supabase.auth.getUser();
    const blockerId = userData.user?.id;
    if (!blockerId) return false;
    const { data } = await supabase
      .from('blocks')
      .select('id')
      .match({ blocker_id: blockerId, blocked_id: userId })
      .maybeSingle();
    return Boolean(data);
  }, []);

  return { submitReport, blockUser, unblockUser, isBlocked };
}
