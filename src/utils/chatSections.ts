import type { Conversation } from '@/hooks/useConversations';
import { groupConversations } from '@/utils/groupConversations';
import type { ForumSummary } from '@/hooks/useForums';

export type ChatSectionKey = 'active' | 'past' | 'forums';

export interface ChatSections {
  /** Everything still live: activity chats whose activity hasn't happened
   *  yet, plus direct chats (which have no date and are never "past"). */
  active: Conversation[];
  /** Activity chats whose activity is over, cancelled or completed. Kept
   *  readable, shown quietly. */
  past: Conversation[];
}

/** Splits conversations into the two conversation-backed sections.
 *
 *  Forums are deliberately NOT merged in here: they are permanent community
 *  spaces with their own source and their own row shape, and mixing them into
 *  activity chats is exactly what the IA is meant to prevent.
 *
 *  Ordering inside `active` puts dated activity chats first, soonest first,
 *  then direct chats by recency. A single recency sort would let an old direct
 *  chat outrank tomorrow's meetup, which is the opposite of what the section
 *  is for. */
export function chatSections(conversations: Conversation[], now: Date = new Date()): ChatSections {
  const { upcoming, past, direct } = groupConversations(conversations, now);
  return { active: [...upcoming, ...direct], past };
}

/** Forums always render in their curated order, never by recency: a fixed
 *  list that reshuffles itself is hard to navigate, and the order encodes
 *  editorial intent. Ties fall back to the key so the result is total. */
export function sortForums(forums: readonly ForumSummary[]): ForumSummary[] {
  return [...forums].sort((a, b) => a.sortOrder - b.sortOrder || a.key.localeCompare(b.key));
}

/** Pinned forums first, then the rest — each group in curated order.
 *
 *  Pinning is NestUp-controlled, so this is deterministic: message activity
 *  never reorders the list. A user who learns where a forum sits finds it in
 *  the same place tomorrow. */
export function partitionForums(forums: readonly ForumSummary[]): {
  pinned: ForumSummary[];
  rest: ForumSummary[];
} {
  const sorted = sortForums(forums);
  return {
    pinned: sorted.filter((forum) => forum.pinned),
    rest: sorted.filter((forum) => !forum.pinned),
  };
}

/** Case- and diacritic-insensitive match over the forum's NAME and
 *  DESCRIPTION only.
 *
 *  Message history is deliberately not searched in this release: that needs
 *  server-side full-text search and a very different result UI. Matching the
 *  resolved title/description strings (not the keys) is what makes search
 *  work in Hebrew as well as English. */
export function filterForums(
  forums: readonly ForumSummary[],
  query: string,
  resolve: (forum: ForumSummary) => { title: string; description: string },
): ForumSummary[] {
  const needle = normalizeForSearch(query);
  if (!needle) return [...forums];
  return forums.filter((forum) => {
    const { title, description } = resolve(forum);
    return normalizeForSearch(title).includes(needle) || normalizeForSearch(description).includes(needle);
  });
}

/** Lowercases and strips combining marks so "Preschools" matches "preschool"
 *  and Hebrew text with or without niqqud compares equal. */
export function normalizeForSearch(value: string): string {
  return value.normalize('NFD').replace(/[̀-֑ͯ-ׇ]/g, '').toLocaleLowerCase().trim();
}

/** Badge text. Caps at "99+" so a busy forum cannot widen the row. */
export function unreadBadgeLabel(count: number): string | null {
  if (count <= 0) return null;
  return count > 99 ? '99+' : String(count);
}

/** True when a section should render its empty state rather than a list.
 *  Forums are excluded on purpose — a seeded forum list is never legitimately
 *  empty, so an empty result means a load failure and must show retry. */
export function shouldShowEmptyState(section: ChatSectionKey, count: number, hasError: boolean): boolean {
  if (section === 'forums') return false;
  return count === 0 && !hasError;
}

/** Total unread across the conversation sections and forums, for the tab
 *  badge. Counts conversations, not messages: the row-level API only exposes
 *  a boolean. */
export function unreadSectionCount(conversations: readonly Conversation[], forums: readonly ForumSummary[]): number {
  return conversations.filter((c) => c.hasUnread).length + forums.filter((f) => f.hasUnread).length;
}
