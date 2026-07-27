/**
 * Formats an activity start time the way a person would say it out loud —
 * urgency-forward for anything happening within the next 24h, calendar-style
 * beyond that. This directly supports the "today rail" urgency pattern.
 */
export function formatStartTime(iso: string, now: Date = new Date()): string {
  const start = new Date(iso);
  const diffMs = start.getTime() - now.getTime();
  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMinutes < 0) return 'Started';
  if (diffMinutes < 60) return `In ${diffMinutes} min`;

  const diffHours = Math.round(diffMinutes / 60);
  const isSameDay = start.toDateString() === now.toDateString();

  if (isSameDay && diffHours < 12) return `In ${diffHours} ${diffHours === 1 ? 'hour' : 'hours'}`;

  const dayLabel = isSameDay
    ? 'Today'
    : start.toDateString() ===
        new Date(now.getTime() + 86400000).toDateString()
      ? 'Tomorrow'
      : start.toLocaleDateString(undefined, { weekday: 'short' });

  const timeLabel = start
    .toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
    .toLowerCase()
    .replace(' ', '');

  return `${dayLabel} ${timeLabel}`;
}
