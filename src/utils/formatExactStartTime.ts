import { activeDateLocale, currentAppLocale, translate } from '@/i18n/core';

/** The exact start time a parent can actually plan around, with relative
 *  context alongside it rather than instead of it — "In 2 hours" alone
 *  forces a mental-math round trip every time the screen re-renders.
 *  `hour: 'numeric'` always includes AM/PM for locales that use a 12-hour
 *  clock (the device's own locale, via `undefined`), so the exact time is
 *  never ambiguous between "9:00" meaning morning or evening. */
export function formatExactStartTime(iso: string, now: Date = new Date()): string {
  const start = new Date(iso);
  const locale = currentAppLocale();
  const timeLabel = start.toLocaleTimeString(activeDateLocale(), { hour: 'numeric', minute: '2-digit' });
  const isSameDay = start.toDateString() === now.toDateString();

  if (isSameDay) {
    const diffMinutes = Math.round((start.getTime() - now.getTime()) / 60000);
    if (diffMinutes <= 0) return translate(locale, 'time.todayAt', { time: timeLabel });
    const relative =
      diffMinutes < 60
        ? translate(locale, 'time.inMinutes', { count: diffMinutes })
        : translate(locale, Math.round(diffMinutes / 60) === 1 ? 'time.inHours.one' : 'time.inHours.other', { count: Math.round(diffMinutes / 60) });
    return translate(locale, 'time.withRelative', {
      exact: translate(locale, 'time.todayAt', { time: timeLabel }),
      relative,
    });
  }

  const tomorrow = new Date(now.getTime() + 86_400_000);
  if (start.toDateString() === tomorrow.toDateString()) {
    return translate(locale, 'time.tomorrowAt', { time: timeLabel });
  }

  const dateLabel = start.toLocaleDateString(activeDateLocale(), { weekday: 'long', month: 'long', day: 'numeric' });
  return translate(locale, 'time.dateAt', { date: dateLabel, time: timeLabel });
}
