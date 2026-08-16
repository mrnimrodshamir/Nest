import { activeDateLocale, currentAppLocale, translate } from '@/i18n/core';

/** "11 hours ago" / "Yesterday" / "3 days ago" / "Jun 12" — how a past
 *  activity's timing reads in Chats' Past section. Deliberately distinct
 *  from formatStartTime (which is future-oriented: "In 2 hours", "Today
 *  3pm") — using that for a past activity produced the wrong-feeling
 *  "Started" for everything, no matter how long ago it actually was. */
export function formatPastRelativeTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const locale = currentAppLocale();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / 3_600_000);

  if (diffHours < 1) return translate(locale, 'time.justNow');
  if (diffHours < 24 && date.toDateString() === now.toDateString()) {
    return translate(locale, diffHours === 1 ? 'time.hoursAgo.one' : 'time.hoursAgo.other', { count: diffHours });
  }

  const yesterday = new Date(now.getTime() - 86_400_000);
  if (date.toDateString() === yesterday.toDateString()) return translate(locale, 'time.yesterday');

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return translate(locale, diffDays === 1 ? 'time.daysAgo.one' : 'time.daysAgo.other', { count: diffDays });

  return date.toLocaleDateString(activeDateLocale(), { month: 'short', day: 'numeric' });
}
