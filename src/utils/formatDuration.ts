import { currentAppLocale, translate } from '@/i18n/core';

export function formatDuration(minutes: number): string {
  const locale = currentAppLocale();
  if (minutes < 60) return translate(locale, 'duration.minutes', { count: minutes });
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  if (hours === 1 && remainder === 0) return translate(locale, 'duration.oneHour');
  if (hours === 1 && remainder === 30) return translate(locale, 'duration.hourAndHalf');
  if (hours === 2 && remainder === 0) return translate(locale, 'duration.twoHours');
  if (remainder === 0) return translate(locale, 'duration.hours', { count: hours });
  if (hours === 1) return translate(locale, 'duration.oneHourMinutes', { minutes: remainder });
  if (hours === 2) return translate(locale, 'duration.twoHoursMinutes', { minutes: remainder });
  return translate(locale, 'duration.hoursMinutes', { hours, minutes: remainder });
}
