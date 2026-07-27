import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/** Resolves (creating if needed, deduped server-side) the 1:1 chat with
 *  another user. Fails clearly if there's no shared activity — matches the
 *  get_or_create_direct_chat() RLS-equivalent check in the DB. */
export function useDirectChatId(otherUserId: string): { chatId: string | null; error: string | null } {
  const [chatId, setChatId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setChatId(null);
    setError(null);

    supabase
      .rpc('get_or_create_direct_chat', { other_user_id: otherUserId })
      .then(({ data, error: rpcError }) => {
        if (cancelled) return;
        if (rpcError || !data) {
          setError(
            rpcError?.message.includes('do not share')
              ? "You can message someone once you've joined the same activity."
              : "Couldn't open this conversation right now.",
          );
          return;
        }
        setChatId(data);
      });

    return () => {
      cancelled = true;
    };
  }, [otherUserId]);

  return { chatId, error };
}
