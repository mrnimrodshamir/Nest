/** "11 hours ago" / "Yesterday" / "3 days ago" / "Jun 12" — how a past
 *  activity's timing reads in Chats' Past section. Deliberately distinct
 *  from formatStartTime (which is future-oriented: "In 2 hours", "Today
 *  3pm") — using that for a past activity produced the wrong-feeling
 *  "Started" for everything, no matter how long ago it actually was. */
export function formatPastRelativeTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / 3_600_000);

  if (diffHours < 1) return 'Just now';
  if (diffHours < 24 && date.toDateString() === now.toDateString()) {
    return `${diffHours} ${diffHours === 1 ? 'hour' : 'hours'} ago`;
  }

  const yesterday = new Date(now.getTime() - 86_400_000);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays} ${diffDays === 1 ? 'day' : 'days'} ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}
