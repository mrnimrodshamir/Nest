import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

interface UseHasUnreadResult {
  hasUnread: boolean;
  refresh: () => Promise<void>;
}

/** True if any message in this chat is newer than the viewer's
 *  last_read_at for it. Checks on mount and whenever the caller invokes
 *  `refresh` — Activity Detail stays mounted underneath Chat in the same
 *  navigation stack, so a plain mount-only check never clears after the
 *  viewer reads the chat and backs out; the caller re-checks on focus. */
export function useHasUnread(chatId: string | null): UseHasUnreadResult {
  const [hasUnread, setHasUnread] = useState(false);

  const check = useCallback(async () => {
    if (!chatId) {
      setHasUnread(false);
      return;
    }
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return;

    const { data: participant } = await supabase
      .from('chat_participants')
      .select('last_read_at')
      .match({ chat_id: chatId, user_id: userId })
      .maybeSingle();
    if (!participant) return;

    const { count } = await supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('chat_id', chatId)
      .neq('sender_id', userId)
      .gt('created_at', participant.last_read_at);
    setHasUnread((count ?? 0) > 0);
  }, [chatId]);

  useEffect(() => {
    check();
  }, [check]);

  return { hasUnread, refresh: check };
}
