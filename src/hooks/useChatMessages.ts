import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  content: string;
  createdAt: string;
  isMine: boolean;
  /** Set on messages that failed to send — lets the UI offer a retry. */
  failed?: boolean;
}

interface UseChatMessagesResult {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  send: (content: string) => Promise<void>;
  retry: (messageId: string) => Promise<void>;
}

interface ProfileLite {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

const PAGE_SIZE = 30;

/** Core message list + realtime + send, shared by both group (per-activity)
 *  and direct (1:1) chat — the only difference between them is how the
 *  chatId is resolved (see useActivityChatId / useDirectChatId). */
export function useChatMessages(chatId: string | null): UseChatMessagesResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const profileCacheRef = useRef<Map<string, ProfileLite>>(new Map());
  const currentUserIdRef = useRef<string | null>(null);

  const resolveSender = useCallback(async (senderId: string): Promise<ProfileLite> => {
    const cached = profileCacheRef.current.get(senderId);
    if (cached) return cached;
    const { data } = await supabase
      .from('public_profiles')
      .select('id, display_name, avatar_url')
      .eq('id', senderId)
      .single();
    const profile: ProfileLite = data ?? { id: senderId, display_name: 'Member', avatar_url: null };
    profileCacheRef.current.set(senderId, profile);
    return profile;
  }, []);

  useEffect(() => {
    if (!chatId) {
      setMessages([]);
      setIsLoading(true);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    async function load() {
      const { data: userData } = await supabase.auth.getUser();
      currentUserIdRef.current = userData.user?.id ?? null;

      // Most-recent page only — older history loads via loadOlder pagination
      // if/when this screen grows a "load more" affordance.
      const { data: messageRows, error: messagesError } = await supabase
        .from('messages')
        .select('id, sender_id, content, created_at')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (cancelled) return;
      if (messagesError) {
        setError("Couldn't load messages.");
        setIsLoading(false);
        return;
      }

      const ordered = (messageRows ?? []).slice().reverse();
      const hydrated = await Promise.all(
        ordered.map(async (row) => {
          const sender = await resolveSender(row.sender_id);
          return {
            id: row.id,
            senderId: row.sender_id,
            senderName: sender.display_name,
            senderAvatarUrl: sender.avatar_url,
            content: row.content,
            createdAt: row.created_at,
            isMine: row.sender_id === currentUserIdRef.current,
          };
        }),
      );
      if (cancelled) return;
      setMessages(hydrated);
      setIsLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [chatId, resolveSender]);

  useEffect(() => {
    if (!chatId) return;
    let cancelled = false;

    const channel = supabase
      .channel(`chat-${chatId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `chat_id=eq.${chatId}` },
        async (payload) => {
          const row = payload.new as { id: string; sender_id: string; content: string; created_at: string };
          const sender = await resolveSender(row.sender_id);
          if (cancelled) return;
          setMessages((current) => {
            if (current.some((m) => m.id === row.id)) return current;
            return [
              ...current,
              {
                id: row.id,
                senderId: row.sender_id,
                senderName: sender.display_name,
                senderAvatarUrl: sender.avatar_url,
                content: row.content,
                createdAt: row.created_at,
                isMine: row.sender_id === currentUserIdRef.current,
              },
            ];
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [chatId, resolveSender]);

  const sendRaw = useCallback(
    async (content: string, retryId?: string) => {
      if (!chatId || !currentUserIdRef.current) return;
      const trimmed = content.trim();
      if (!trimmed) return;

      const tempId = retryId ?? `pending-${Date.now()}`;
      if (!retryId) {
        setMessages((current) => [
          ...current,
          {
            id: tempId,
            senderId: currentUserIdRef.current!,
            senderName: 'You',
            senderAvatarUrl: null,
            content: trimmed,
            createdAt: new Date().toISOString(),
            isMine: true,
          },
        ]);
      } else {
        setMessages((current) => current.map((m) => (m.id === tempId ? { ...m, failed: false } : m)));
      }

      const { data, error: sendError } = await supabase
        .from('messages')
        .insert({ chat_id: chatId, sender_id: currentUserIdRef.current, content: trimmed })
        .select('id, created_at')
        .single();

      if (sendError || !data) {
        setMessages((current) => current.map((m) => (m.id === tempId ? { ...m, failed: true } : m)));
        return;
      }

      // Swap the optimistic row for the real one (avoids a duplicate when
      // the realtime INSERT event for our own message arrives).
      setMessages((current) =>
        current.map((m) => (m.id === tempId ? { ...m, id: data.id, createdAt: data.created_at } : m)),
      );
      // Never track message content -- only that a send happened.
      track('chat_message_sent', { chat_id: chatId });
    },
    [chatId],
  );

  const send = useCallback((content: string) => sendRaw(content), [sendRaw]);

  const retry = useCallback(
    async (messageId: string) => {
      const target = messages.find((m) => m.id === messageId);
      if (!target) return;
      await sendRaw(target.content, messageId);
    },
    [messages, sendRaw],
  );

  return { messages, isLoading, error, send, retry };
}
