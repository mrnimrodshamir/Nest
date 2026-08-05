import type { EventDetails } from '@/types/event';

export function groupPlaceEvents(events: readonly EventDetails[]): { today: EventDetails[]; upcoming: EventDetails[] } {
  const visible = events.filter((event) => event.lifecycle !== 'cancelled' && event.lifecycle !== 'finished');
  const byStart = (left: EventDetails, right: EventDetails) => Date.parse(left.occurrence.startsAt) - Date.parse(right.occurrence.startsAt) || left.occurrence.id.localeCompare(right.occurrence.id);
  return {
    today: visible.filter((event) => event.lifecycle === 'today' || event.lifecycle === 'live').sort(byStart),
    upcoming: visible.filter((event) => event.lifecycle === 'upcoming' || event.lifecycle === 'postponed').sort(byStart),
  };
}
