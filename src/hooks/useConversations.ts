import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { ActivityCategory, ActivityStatus } from '@/types/activity';

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
  /** Who sent the last message — "Maya", or "You" when it was the viewer.
   *  Null when there's no message yet. Group chats show this ahead of the
   *  preview ("Maya: See you tomorrow"); direct chats don't need it since
   *  the header already says who the conversation is with. */
  lastMessageSenderName: string | null;
  hasUnread: boolean;
  /** Group chats only — drives the Upcoming/Past split and the richer row
   *  content (thumbnail, date, location, participant count). Null for
   *  direct chats, which aren't tied to an activity. */
  activity: {
    category: ActivityCategory;
    startTime: string;
    status: ActivityStatus;
    locationLabel: string;
    attendeeCount: number;
    coverImageUrl: string | null;
  } | null;
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
      // Every distinct sender whose name we might need to show — direct
      // chat partners, plus whoever sent each chat's most recent message
      // (so a group row can read "Maya: See you tomorrow" instead of just
      // the bare message text).
      const senderIdsNeedingProfiles = new Set<string>();
      for (const otherUserId of otherUserIdByChat.values()) senderIdsNeedingProfiles.add(otherUserId);
      for (const message of lastMessageByChat.values()) {
        if (message.sender_id !== userId) senderIdsNeedingProfiles.add(message.sender_id);
      }
      const profileIdsToFetch = Array.from(senderIdsNeedingProfiles);

      const [{ data: activityRows }, { data: profileRows }, { data: attendeeRows }] = await Promise.all([
        groupActivityIds.length > 0
          ? supabase
              .from('activities')
              .select('id, title, cover_image_url, category, start_time, status, address_label')
              .in('id', groupActivityIds)
          : Promise.resolve({
              data: [] as {
                id: string;
                title: string;
                cover_image_url: string | null;
                category: ActivityCategory;
                start_time: string;
                status: ActivityStatus;
                address_label: string;
              }[],
            }),
        profileIdsToFetch.length > 0
          ? supabase.from('public_profiles').select('id, display_name, avatar_url').in('id', profileIdsToFetch)
          : Promise.resolve({ data: [] as { id: string; display_name: string; avatar_url: string | null }[] }),
        groupActivityIds.length > 0
          ? supabase
              .from('activity_attendees')
              .select('activity_id')
              .in('activity_id', groupActivityIds)
              .in('status', ['going', 'attended'])
          : Promise.resolve({ data: [] as { activity_id: string }[] }),
      ]);
      const activityById = new Map((activityRows ?? []).map((a) => [a.id, a]));
      const profileById = new Map((profileRows ?? []).map((p) => [p.id, p]));
      const attendeeCountByActivity = new Map<string, number>();
      for (const row of attendeeRows ?? []) {
        attendeeCountByActivity.set(row.activity_id, (attendeeCountByActivity.get(row.activity_id) ?? 0) + 1);
      }

      const result: Conversation[] = (chatRows ?? []).map((chat) => {
        const lastMessage = lastMessageByChat.get(chat.id);
        const readAt = readAtByChat.get(chat.id);
        const hasUnread = Boolean(
          lastMessage && lastMessage.sender_id !== userId && (!readAt || lastMessage.created_at > readAt),
        );
        const lastMessageSenderName = lastMessage
          ? lastMessage.sender_id === userId
            ? 'You'
            : (profileById.get(lastMessage.sender_id)?.display_name ?? null)
          : null;

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
            lastMessageSenderName,
            hasUnread,
            activity: null,
          };
        }

        const activityRow = chat.activity_id ? activityById.get(chat.activity_id) : null;
        return {
          chatId: chat.id,
          kind: 'group' as const,
          title: activityRow?.title ?? 'Activity chat',
          subtitle: lastMessage?.content ?? 'Say hello 👋',
          avatarUrl: activityRow?.cover_image_url ?? null,
          otherUserId: null,
          activityId: chat.activity_id,
          lastMessageAt: lastMessage?.created_at ?? null,
          lastMessagePreview: lastMessage?.content ?? '',
          lastMessageSenderName,
          hasUnread,
          activity: activityRow
            ? {
                category: activityRow.category,
                startTime: activityRow.start_time,
                status: activityRow.status,
                locationLabel: activityRow.address_label,
                attendeeCount: attendeeCountByActivity.get(activityRow.id) ?? 0,
                coverImageUrl: activityRow.cover_image_url,
              }
            : null,
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
