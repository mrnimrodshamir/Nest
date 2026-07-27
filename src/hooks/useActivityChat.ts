import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  content: string;
  createdAt: string;
  isMine: boolean;
}

interface UseActivityChatResult {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  send: (content: string) => Promise<void>;
}

interface ProfileLite {
  id: string;
  display_name: string;
  avatar_url: string | null;
}

export function useActivityChat(activityId: string): UseActivityChatResult {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const chatIdRef = useRef<string | null>(null);
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
    let cancelled = false;

    async function init() {
      setIsLoading(true);
      setError(null);

      const { data: userData } = await supabase.auth.getUser();
      currentUserIdRef.current = userData.user?.id ?? null;

      const { data: chat, error: chatError } = await supabase
        .from('chats')
        .select('id')
        .eq('activity_id', activityId)
        .eq('type', 'group')
        .maybeSingle();

      if (cancelled) return;
      if (chatError || !chat) {
        setError("Couldn't open this chat right now.");
        setIsLoading(false);
        return;
      }
      chatIdRef.current = chat.id;

      const { data: messageRows, error: messagesError } = await supabase
        .from('messages')
        .select('id, sender_id, content, created_at')
        .eq('chat_id', chat.id)
        .order('created_at', { ascending: true });

      if (cancelled) return;
      if (messagesError) {
        setError("Couldn't load messages.");
        setIsLoading(false);
        return;
      }

      const hydrated = await Promise.all(
        (messageRows ?? []).map(async (row) => {
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

    init();

    return () => {
      cancelled = true;
    };
  }, [activityId, resolveSender]);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    async function subscribe() {
      // Wait for chatIdRef to be populated by the init effect above.
      while (!chatIdRef.current && !cancelled) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (cancelled || !chatIdRef.current) return;

      channel = supabase
        .channel(`activity-chat-${activityId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'messages',
            filter: `chat_id=eq.${chatIdRef.current}`,
          },
          async (payload) => {
            const row = payload.new as { id: string; sender_id: string; content: string; created_at: string };
            const sender = await resolveSender(row.sender_id);
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
    }

    subscribe();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [activityId, resolveSender]);

  const send = useCallback(async (content: string) => {
    if (!chatIdRef.current || !currentUserIdRef.current) return;
    const trimmed = content.trim();
    if (!trimmed) return;
    const { error: sendError } = await supabase.from('messages').insert({
      chat_id: chatIdRef.current,
      sender_id: currentUserIdRef.current,
      content: trimmed,
    });
    if (sendError) setError("Couldn't send that message — try again.");
  }, []);

  return { messages, isLoading, error, send };
}
