import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/** True if any message in this chat is newer than the viewer's
 *  last_read_at for it. Re-checks on every mount (e.g. returning to
 *  Activity Detail) — good enough without a full unread-count pipeline. */
export function useHasUnread(chatId: string | null): boolean {
  const [hasUnread, setHasUnread] = useState(false);

  useEffect(() => {
    if (!chatId) {
      setHasUnread(false);
      return;
    }
    let cancelled = false;

    async function check() {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;

      const { data: participant } = await supabase
        .from('chat_participants')
        .select('last_read_at')
        .match({ chat_id: chatId, user_id: userId })
        .maybeSingle();
      if (cancelled || !participant) return;

      const { count } = await supabase
        .from('messages')
        .select('id', { count: 'exact', head: true })
        .eq('chat_id', chatId)
        .neq('sender_id', userId)
        .gt('created_at', participant.last_read_at);
      if (cancelled) return;
      setHasUnread((count ?? 0) > 0);
    }

    check();
    return () => {
      cancelled = true;
    };
  }, [chatId]);

  return hasUnread;
}
