import { activeDateLocale, currentAppLocale, translate } from '@/i18n/core';

/** Short, chat-inbox-style relative timestamp: "2m", "3h", "Tue", "Mar 4". */
export function formatRelativeTime(iso: string, now: Date = new Date()): string {
  const date = new Date(iso);
  const locale = currentAppLocale();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return translate(locale, 'time.shortNow');
  if (diffMin < 60) return translate(locale, 'time.shortMinutes', { count: diffMin });
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24 && date.toDateString() === now.toDateString()) return translate(locale, 'time.shortHours', { count: diffHours });

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return date.toLocaleDateString(activeDateLocale(), { weekday: 'short' });
  return date.toLocaleDateString(activeDateLocale(), { month: 'short', day: 'numeric' });
}
