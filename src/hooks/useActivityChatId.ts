import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

/** Resolves an activity's group chat id. Only meaningful once the viewer
 *  is a participant (host or joined attendee) — otherwise RLS returns
 *  nothing and this stays null. */
export function useActivityChatId(activityId: string): { chatId: string | null; error: string | null } {
  const [chatId, setChatId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setChatId(null);
    setError(null);

    supabase
      .from('chats')
      .select('id')
      .eq('activity_id', activityId)
      .eq('type', 'group')
      .maybeSingle()
      .then(({ data, error: fetchError }) => {
        if (cancelled) return;
        if (fetchError || !data) {
          setError("Couldn't open this chat right now.");
          return;
        }
        setChatId(data.id);
      });

    return () => {
      cancelled = true;
    };
  }, [activityId]);

  return { chatId, error };
}
