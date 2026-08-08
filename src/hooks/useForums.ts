import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { forumDefinition, isForumKey, type ForumKey } from '@/constants/forums';
import type { TranslationKey } from '@/i18n';

export interface ForumSummary {
  key: ForumKey;
  chatId: string;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  icon: string;
  sortOrder: number;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
  lastMessageSenderName: string | null;
  hasUnread: boolean;
  /** Bounded at 100 server-side; the badge renders "99+" beyond that. */
  unreadCount: number;
  pinned: boolean;
}

interface UseForumsResult {
  forums: ForumSummary[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

interface ForumOverviewRow {
  key: string;
  chat_id: string;
  icon: string;
  sort_order: number;
  fallback_title: string;
  last_message_content: string | null;
  last_message_at: string | null;
  last_message_sender_name: string | null;
  has_unread: boolean;
  unread_count: number | null;
}

/** The Forums list.
 *
 *  ONE round trip that returns metadata plus a single preview message per
 *  forum — never message history. Opening a forum loads its messages
 *  separately and paginated, so the Chats screen cost stays flat no matter how
 *  busy the forums get. */
export function useForums(): UseForumsResult {
  const [forums, setForums] = useState<ForumSummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('forum_overview');
      if (rpcError) throw rpcError;

      const rows = (data ?? []) as ForumOverviewRow[];
      const mapped: ForumSummary[] = [];
      for (const row of rows) {
        // A forum the server knows about but this build does not has no
        // translated title, so it is skipped rather than rendered as a raw
        // key. This is what lets new forums be seeded server-side without
        // breaking older clients.
        if (!isForumKey(row.key)) continue;
        const definition = forumDefinition(row.key);
        if (!definition) continue;
        mapped.push({
          key: definition.key,
          chatId: row.chat_id,
          titleKey: definition.titleKey,
          descriptionKey: definition.descriptionKey,
          icon: definition.icon,
          sortOrder: row.sort_order ?? definition.sortOrder,
          lastMessagePreview: row.last_message_content,
          lastMessageAt: row.last_message_at,
          lastMessageSenderName: row.last_message_sender_name,
          hasUnread: Boolean(row.has_unread),
          unreadCount: row.unread_count ?? 0,
          // Pinning is a CLIENT-side editorial decision, not server data, so
          // curation can change in a release without a migration.
          pinned: Boolean(definition.pinned),
        });
      }
      setForums(mapped);
    } catch (err) {
      console.log('[Forums] load failed', err instanceof Error ? err.message : err);
      // Deliberately leaves `forums` as-is: a failed refresh keeps whatever
      // was already on screen rather than blanking it.
      setError("Couldn't load forums.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { forums, isLoading, error, refresh: load };
}

/** Joins (idempotently) and returns the forum's chat id.
 *
 *  Membership exists only to satisfy the participation-based RLS that already
 *  guards every chat; it is never surfaced as a "Join" step in the UI. */
export async function openForum(key: ForumKey): Promise<string | null> {
  try {
    const { data, error } = await supabase.rpc('join_forum', { p_key: key });
    if (error) throw error;
    return (data as string | null) ?? null;
  } catch (err) {
    console.log('[Forums] join failed', err instanceof Error ? err.message : err);
    return null;
  }
}
