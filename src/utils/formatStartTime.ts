import { activeDateLocale, currentAppLocale, translate } from '@/i18n/core';

/**
 * Formats an activity start time the way a person would say it out loud —
 * urgency-forward for anything happening within the next 24h, calendar-style
 * beyond that. This directly supports the "today rail" urgency pattern.
 */
export function formatStartTime(iso: string, now: Date = new Date()): string {
  const start = new Date(iso);
  const locale = currentAppLocale();
  const diffMs = start.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMinutes < 0) return translate(locale, 'time.started');
  if (diffMinutes < 60) return translate(locale, 'time.inMinutes', { count: diffMinutes });

  const diffHours = Math.round(diffMinutes / 60);
  const isSameDay = start.toDateString() === now.toDateString();

  if (isSameDay && diffHours < 12) return translate(locale, diffHours === 1 ? 'time.inHours.one' : 'time.inHours.other', { count: diffHours });

  const dayLabel = isSameDay
    ? translate(locale, 'time.today')
    : start.toDateString() ===
        new Date(now.getTime() + 86400000).toDateString()
      ? translate(locale, 'time.tomorrow')
      : start.toLocaleDateString(activeDateLocale(), { weekday: 'short' });

  const timeLabel = start
    .toLocaleTimeString(activeDateLocale(), { hour: 'numeric', minute: '2-digit' })
    .toLowerCase()
    .replace(' ', '');

  return translate(locale, 'time.dayTime', { day: dayLabel, time: timeLabel });
}
