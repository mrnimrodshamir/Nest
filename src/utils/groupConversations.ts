import type { Conversation } from '@/hooks/useConversations';

/** A group chat is "upcoming" iff its activity hasn't been cancelled or
 *  completed AND its start time hasn't passed yet. Date.getTime() compares
 *  absolute epoch milliseconds, so this is correct across timezones and
 *  DST boundaries regardless of the device's local timezone — there's no
 *  manual date-math to get wrong here. `now` is injectable for tests. */
export function isUpcomingActivity(activity: NonNullable<Conversation['activity']>, now: Date = new Date()): boolean {
  if (activity.status === 'cancelled' || activity.status === 'completed') return false;
  return new Date(activity.startTime).getTime() >= now.getTime();
}

export interface GroupedConversations {
  /** Soonest first. */
  upcoming: Conversation[];
  /** Most recently messaged first. */
  past: Conversation[];
  /** Most recently messaged first — person-to-person chats, which aren't
   *  tied to an activity date so they never fit the upcoming/past split. */
  direct: Conversation[];
}

/** Splits the flat conversation list into Chats' three sections. A
 *  conversation with no `activity` record (deleted/never loaded) falls
 *  through to `direct` rather than crashing on a null check. */
export function groupConversations(conversations: Conversation[], now: Date = new Date()): GroupedConversations {
  const upcoming: Conversation[] = [];
  const past: Conversation[] = [];
  const direct: Conversation[] = [];

  for (const conversation of conversations) {
    if (!conversation.activity) direct.push(conversation);
    else if (isUpcomingActivity(conversation.activity, now)) upcoming.push(conversation);
    else past.push(conversation);
  }

  upcoming.sort((a, b) => a.activity!.startTime.localeCompare(b.activity!.startTime));
  past.sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''));
  direct.sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''));

  return { upcoming, past, direct };
}
