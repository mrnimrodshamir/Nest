/** The exact start time a parent can actually plan around, with relative
 *  context alongside it rather than instead of it — "In 2 hours" alone
 *  forces a mental-math round trip every time the screen re-renders.
 *  `hour: 'numeric'` always includes AM/PM for locales that use a 12-hour
 *  clock (the device's own locale, via `undefined`), so the exact time is
 *  never ambiguous between "9:00" meaning morning or evening. */
export function formatExactStartTime(iso: string, now: Date = new Date()): string {
  const start = new Date(iso);
  const timeLabel = start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  const isSameDay = start.toDateString() === now.toDateString();

  if (isSameDay) {
    const diffMinutes = Math.round((start.getTime() - now.getTime()) / 60000);
    if (diffMinutes <= 0) return `Today at ${timeLabel}`;
    const relative =
      diffMinutes < 60
        ? `In ${diffMinutes} min`
        : `In ${Math.round(diffMinutes / 60)} ${Math.round(diffMinutes / 60) === 1 ? 'hour' : 'hours'}`;
    return `Today at ${timeLabel} · ${relative}`;
  }

  const tomorrow = new Date(now.getTime() + 86_400_000);
  if (start.toDateString() === tomorrow.toDateString()) {
    return `Tomorrow at ${timeLabel}`;
  }

  const dateLabel = start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
  return `${dateLabel} at ${timeLabel}`;
}
