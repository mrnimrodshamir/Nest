import { currentAppLocale, translate } from '@/i18n/core';

export function formatDuration(minutes: number): string {
  const locale = currentAppLocale();
  if (minutes < 60) return translate(locale, 'duration.minutes', { count: minutes });
  const hours = minutes / 60;
  return translate(locale, 'duration.hours', { count: Number.isInteger(hours) ? hours : hours.toFixed(1) });
}
