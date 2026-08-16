import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { currentAppLocale, translate } from '@/i18n';

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
    if (!reporterId) return translate(currentAppLocale(), 'error.notSignedIn');
    const { error } = await supabase.from('reports').insert({
      reporter_id: reporterId,
      reported_user_id: input.reportedUserId,
      activity_id: input.activityId ?? null,
      reason: input.reason,
    });
    if (error) console.log('[ReportAndBlock] report failed', error.message);
    return error ? translate(currentAppLocale(), 'activity.reportError') : null;
  }, []);

  const blockUser = useCallback(async (userId: string) => {
    const { data: userData } = await supabase.auth.getUser();
    const blockerId = userData.user?.id;
    if (!blockerId) return translate(currentAppLocale(), 'error.notSignedIn');
    const { error } = await supabase.from('blocks').insert({ blocker_id: blockerId, blocked_id: userId });
    if (error) console.log('[ReportAndBlock] block failed', error.message);
    return error ? translate(currentAppLocale(), 'activity.blockError') : null;
  }, []);

  const unblockUser = useCallback(async (userId: string) => {
    const { data: userData } = await supabase.auth.getUser();
    const blockerId = userData.user?.id;
    if (!blockerId) return translate(currentAppLocale(), 'error.notSignedIn');
    const { error } = await supabase.from('blocks').delete().match({ blocker_id: blockerId, blocked_id: userId });
    if (error) console.log('[ReportAndBlock] unblock failed', error.message);
    return error ? translate(currentAppLocale(), 'blocked.errorTitle') : null;
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
