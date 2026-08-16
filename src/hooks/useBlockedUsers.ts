import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { safeCaregiverDisplayName } from '@/utils/profileIdentity';
import { currentAppLocale, translate } from '@/i18n';

export interface BlockedUser {
  id: string;
  displayName: string;
  avatarUrl: string | null;
}

interface UseBlockedUsersResult {
  blockedUsers: BlockedUser[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  unblock: (userId: string) => Promise<string | null>;
}

/** Everyone the current user has blocked — the other half of the block
 *  flow started in Activity Detail: without this, "block" would be a
 *  one-way, unreversible action with no way to see or undo it. */
export function useBlockedUsers(): UseBlockedUsersResult {
  const [blockedUsers, setBlockedUsers] = useState<BlockedUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const blockerId = userData.user?.id;
      if (!blockerId) {
        setBlockedUsers([]);
        return;
      }
      const { data: blockRows, error: blockError } = await supabase
        .from('blocks')
        .select('blocked_id')
        .eq('blocker_id', blockerId);
      if (blockError) throw blockError;

      const blockedIds = (blockRows ?? []).map((row) => row.blocked_id);
      if (blockedIds.length === 0) {
        setBlockedUsers([]);
        return;
      }
      const { data: profileRows, error: profileError } = await supabase
        .from('public_profiles')
        .select('id, display_name, avatar_url')
        .in('id', blockedIds);
      if (profileError) throw profileError;

      setBlockedUsers((profileRows ?? []).map((p) => ({ id: p.id, displayName: safeCaregiverDisplayName(p.display_name), avatarUrl: p.avatar_url })));
    } catch (err) {
      console.log('[BlockedUsers] load failed', err instanceof Error ? err.message : err);
      setError(translate(currentAppLocale(), 'error.blockedLoad'));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const unblock = useCallback(
    async (userId: string) => {
      const { data: userData } = await supabase.auth.getUser();
      const blockerId = userData.user?.id;
      if (!blockerId) return 'Not signed in.';
      const { error: deleteError } = await supabase
        .from('blocks')
        .delete()
        .match({ blocker_id: blockerId, blocked_id: userId });
      if (deleteError) return deleteError.message;
      await load();
      return null;
    },
    [load],
  );

  return { blockedUsers, isLoading, error, refresh: load, unblock };
}
