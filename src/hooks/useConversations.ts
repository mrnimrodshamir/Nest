import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface Conversation {
  chatId: string;
  kind: 'group' | 'direct';
  title: string;
  subtitle: string;
  avatarUrl: string | null;
  /** Only set for direct chats — needed to open ChatScreen. */
  otherUserId: string | null;
  /** Only set for group chats — needed to open ChatScreen. */
  activityId: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string;
  hasUnread: boolean;
}

interface UseConversationsResult {
  conversations: Conversation[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

/** Every chat the current user participates in — group (per-activity) and
 *  direct — as one unified, most-recent-first list for the Messages inbox. */
export function useConversations(): UseConversationsResult {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        setConversations([]);
        return;
      }

      const { data: myParticipation, error: participationError } = await supabase
        .from('chat_participants')
        .select('chat_id, last_read_at')
        .eq('user_id', userId);
      if (participationError) throw participationError;
      if (!myParticipation || myParticipation.length === 0) {
        setConversations([]);
        return;
      }
      const chatIds = myParticipation.map((p) => p.chat_id);
      const readAtByChat = new Map(myParticipation.map((p) => [p.chat_id, p.last_read_at]));

      const [{ data: chatRows }, { data: allParticipants }, { data: recentMessages }] = await Promise.all([
        supabase.from('chats').select('id, activity_id, type').in('id', chatIds),
        supabase.from('chat_participants').select('chat_id, user_id').in('chat_id', chatIds),
        supabase
          .from('messages')
          .select('chat_id, sender_id, content, created_at')
          .in('chat_id', chatIds)
          .order('created_at', { ascending: false })
          .limit(500),
      ]);

      const lastMessageByChat = new Map<string, { sender_id: string; content: string; created_at: string }>();
      for (const row of recentMessages ?? []) {
        if (!lastMessageByChat.has(row.chat_id)) lastMessageByChat.set(row.chat_id, row);
      }

      const otherUserIdByChat = new Map<string, string>();
      for (const row of allParticipants ?? []) {
        if (row.user_id !== userId) otherUserIdByChat.set(row.chat_id, row.user_id);
      }

      const groupActivityIds = (chatRows ?? [])
        .filter((c) => c.type === 'group' && c.activity_id)
        .map((c) => c.activity_id as string);
      const directOtherUserIds = Array.from(otherUserIdByChat.values());

      const [{ data: activityRows }, { data: profileRows }] = await Promise.all([
        groupActivityIds.length > 0
          ? supabase.from('activities').select('id, title, cover_image_url').in('id', groupActivityIds)
          : Promise.resolve({ data: [] as { id: string; title: string; cover_image_url: string | null }[] }),
        directOtherUserIds.length > 0
          ? supabase.from('public_profiles').select('id, display_name, avatar_url').in('id', directOtherUserIds)
          : Promise.resolve({ data: [] as { id: string; display_name: string; avatar_url: string | null }[] }),
      ]);
      const activityById = new Map((activityRows ?? []).map((a) => [a.id, a]));
      const profileById = new Map((profileRows ?? []).map((p) => [p.id, p]));

      const result: Conversation[] = (chatRows ?? []).map((chat) => {
        const lastMessage = lastMessageByChat.get(chat.id);
        const readAt = readAtByChat.get(chat.id);
        const hasUnread = Boolean(
          lastMessage && lastMessage.sender_id !== userId && (!readAt || lastMessage.created_at > readAt),
        );

        if (chat.type === 'direct') {
          const otherUserId = otherUserIdByChat.get(chat.id) ?? null;
          const profile = otherUserId ? profileById.get(otherUserId) : null;
          return {
            chatId: chat.id,
            kind: 'direct' as const,
            title: profile?.display_name ?? 'Momzi member',
            subtitle: lastMessage?.content ?? 'Say hello 👋',
            avatarUrl: profile?.avatar_url ?? null,
            otherUserId,
            activityId: null,
            lastMessageAt: lastMessage?.created_at ?? null,
            lastMessagePreview: lastMessage?.content ?? '',
            hasUnread,
          };
        }

        const activity = chat.activity_id ? activityById.get(chat.activity_id) : null;
        return {
          chatId: chat.id,
          kind: 'group' as const,
          title: activity?.title ?? 'Activity chat',
          subtitle: lastMessage?.content ?? 'Say hello 👋',
          avatarUrl: activity?.cover_image_url ?? null,
          otherUserId: null,
          activityId: chat.activity_id,
          lastMessageAt: lastMessage?.created_at ?? null,
          lastMessagePreview: lastMessage?.content ?? '',
          hasUnread,
        };
      });

      result.sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''));
      setConversations(result);
    } catch (err) {
      console.log('[Conversations] load failed', err instanceof Error ? err.message : err);
      setError("Couldn't load your messages.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { conversations, isLoading, error, refresh: load };
}
