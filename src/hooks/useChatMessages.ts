import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { track } from '@/lib/analytics';
import { safeCaregiverDisplayName } from '@/utils/profileIdentity';
import { currentAppLocale, translate } from '@/i18n';
import { formatChatSystemMessage } from '@/utils/formatChatSystemMessage';

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  content: string;
  createdAt: string;
  isMine: boolean;
  isSystem?: boolean;
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
export function useChatMessages(chatId: string | null, analyticsEvent: 'chat_message_sent' | 'forum_message_sent' = 'chat_message_sent'): UseChatMessagesResult {
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
    const rawProfile: ProfileLite = data ?? { id: senderId, display_name: '', avatar_url: null };
    const profile: ProfileLite = { ...rawProfile, display_name: safeCaregiverDisplayName(rawProfile.display_name) };
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
        .select('id, sender_id, content, created_at, kind, metadata')
        .eq('chat_id', chatId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (cancelled) return;
      if (messagesError) {
        setError(translate(currentAppLocale(), 'chats.error.load'));
        setIsLoading(false);
        return;
      }

      const ordered = (messageRows ?? []).slice().reverse();
      const hydrated = await Promise.all(
        ordered.map(async (row) => {
          if (row.kind === 'system') {
            return {
              id: row.id,
              senderId: '',
              senderName: '',
              senderAvatarUrl: null,
              content: formatChatSystemMessage(row.metadata as Record<string, unknown> | null, currentAppLocale()),
              createdAt: row.created_at,
              isMine: false,
              isSystem: true,
            };
          }
          const isMine = row.sender_id === currentUserIdRef.current;
          // Own messages always read "You" — resolving your own profile
          // just to print your own display name back at you (differently
          // than a freshly-sent message in the same session, which already
          // uses 'You') is an inconsistency, not a feature.
          if (isMine) {
            return {
              id: row.id,
              senderId: row.sender_id,
              senderName: translate(currentAppLocale(), 'chat.you'),
              senderAvatarUrl: null,
              content: row.content,
              createdAt: row.created_at,
              isMine: true,
            };
          }
          const sender = await resolveSender(row.sender_id);
          return {
            id: row.id,
            senderId: row.sender_id,
            senderName: sender.display_name,
            senderAvatarUrl: sender.avatar_url,
            content: row.content,
            createdAt: row.created_at,
            isMine: false,
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
          const row = payload.new as { id: string; sender_id: string | null; content: string; created_at: string; kind?: string; metadata?: Record<string, unknown> | null };
          if (row.kind === 'system') {
            if (cancelled) return;
            setMessages((current) => current.some((message) => message.id === row.id) ? current : [...current, {
              id: row.id,
              senderId: '',
              senderName: '',
              senderAvatarUrl: null,
              content: formatChatSystemMessage(row.metadata ?? null, currentAppLocale()),
              createdAt: row.created_at,
              isMine: false,
              isSystem: true,
            }]);
            return;
          }
          const senderId = row.sender_id;
          if (!senderId) return;
          const sender = await resolveSender(senderId);
          if (cancelled) return;
          const isMine = senderId === currentUserIdRef.current;
          setMessages((current) => {
            if (current.some((m) => m.id === row.id)) return current;
            return [
              ...current,
              {
                id: row.id,
                senderId,
                senderName: isMine ? translate(currentAppLocale(), 'chat.you') : sender.display_name,
                senderAvatarUrl: sender.avatar_url,
                content: row.content,
                createdAt: row.created_at,
                isMine,
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
            senderName: translate(currentAppLocale(), 'chat.you'),
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
      track(analyticsEvent, analyticsEvent === 'forum_message_sent' ? { forum_session: true } : { chat_id: chatId });
    },
    [analyticsEvent, chatId],
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
