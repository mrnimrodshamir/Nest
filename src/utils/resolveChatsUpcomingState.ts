export type ChatsUpcomingState =
  | 'empty-no-past'
  | 'empty-with-past'
  | 'has-upcoming';

/** What the Chats screen's "Upcoming activities" section should show,
 *  given how many upcoming vs. past activity chats exist. Kept separate
 *  from the overall list-empty state: a parent with only past chats still
 *  needs an obvious "go create one" nudge in the Upcoming section, not
 *  just a single generic empty screen that would hide their past chats. */
export function resolveChatsUpcomingState(upcomingCount: number, pastCount: number): ChatsUpcomingState {
  if (upcomingCount > 0) return 'has-upcoming';
  return pastCount > 0 ? 'empty-with-past' : 'empty-no-past';
}
