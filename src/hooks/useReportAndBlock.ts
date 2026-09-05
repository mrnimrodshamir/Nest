import { useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { currentAppLocale, translate } from '@/i18n';
import type { SubmitReportInput } from '@/types/moderation';
import { markUserBlocked, markUserUnblocked } from '@/lib/blockState';

interface UseReportAndBlockResult {
  submitReport: (input: SubmitReportInput) => Promise<string | null>;
  blockUser: (userId: string) => Promise<string | null>;
  unblockUser: (userId: string) => Promise<string | null>;
  isBlocked: (userId: string) => Promise<boolean>;
}

/** Thin wrapper over the `reports`/`blocks` tables — both already existed
 *  in the schema with correct RLS; this is the first client code to use
 *  them. Kept deliberately small: no moderation UI, no report history view,
 *  just the two actions a user actually needs. */
export function useReportAndBlock(): UseReportAndBlockResult {
  const submitReport = useCallback(async (input: SubmitReportInput) => {
    const { error } = await supabase.rpc('submit_content_report', {
      p_target_type: input.target.type,
      p_target_id: input.target.id,
      p_reason: input.reason,
      p_details: input.details?.trim() || null,
    });
    if (error) console.log('[ReportAndBlock] report failed', error.message);
    return error ? translate(currentAppLocale(), 'report.error') : null;
  }, []);

  const blockUser = useCallback(async (userId: string) => {
    const { error } = await supabase.rpc('block_user_with_moderation', { p_blocked_user_id: userId });
    if (error) console.log('[ReportAndBlock] block failed', error.message);
    if (!error) markUserBlocked(userId);
    return error ? translate(currentAppLocale(), 'activity.blockError') : null;
  }, []);

  const unblockUser = useCallback(async (userId: string) => {
    const { data: userData } = await supabase.auth.getUser();
    const blockerId = userData.user?.id;
    if (!blockerId) return translate(currentAppLocale(), 'error.notSignedIn');
    const { error } = await supabase.from('blocks').delete().match({ blocker_id: blockerId, blocked_id: userId });
    if (error) console.log('[ReportAndBlock] unblock failed', error.message);
    if (!error) markUserUnblocked(userId);
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
