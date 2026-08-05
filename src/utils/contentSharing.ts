import { APP_NAME } from '@/constants/brand';

export type ShareContentType = 'activity' | 'place' | 'event';

export function contentDeepLink(type: ShareContentType, id: string): string {
  return `nestup://${type}/${encodeURIComponent(id)}`;
}

export function buildPlaceShareMessage(input: {
  id: string;
  name: string;
  location: string | null;
}): string {
  const where = input.location?.trim() ? ` in ${input.location.trim()}` : '';
  return `Discover ${input.name.trim()}${where} on ${APP_NAME}.\n${contentDeepLink('place', input.id)}`;
}

export function buildEventShareMessage(input: {
  occurrenceId: string;
  title: string;
  startsAt: string;
  location: string | null;
  status: 'scheduled' | 'cancelled' | 'postponed';
}): string {
  const date = new Date(input.startsAt);
  const when = Number.isNaN(date.getTime())
    ? ''
    : ` ${date.toLocaleString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'Asia/Jerusalem',
      })}`;
  const where = input.location?.trim() ? ` at ${input.location.trim()}` : '';
  const state = input.status === 'cancelled'
    ? 'Cancelled event:'
    : input.status === 'postponed'
      ? 'Postponed event:'
      : 'Event:';
  return `${state} ${input.title.trim()}${when}${where}. View it on ${APP_NAME}.\n${contentDeepLink('event', input.occurrenceId)}`;
}

export function buildWhatsAppUrl(message: string): string {
  return `whatsapp://send?text=${encodeURIComponent(message)}`;
}

export type SharedContentRoute =
  | { screen: 'ActivityDetail'; params: { activityId: string } }
  | { screen: 'PlaceDetails'; params: { placeId: string } }
  | { screen: 'EventDetails'; params: { occurrenceId: string } };

/** Parses canonical and legacy custom-scheme links without accepting arbitrary routes. */
export function parseSharedContentUrl(value: string): SharedContentRoute | null {
  const match = /^(?:nestup|momzi):\/\/(activity|place|event)\/([^/?#]+)(?:[?#].*)?$/i.exec(value.trim());
  if (!match) return null;
  let id: string;
  try { id = decodeURIComponent(match[2]); } catch { return null; }
  if (!id.trim()) return null;
  if (match[1].toLowerCase() === 'activity') return { screen: 'ActivityDetail', params: { activityId: id } };
  if (match[1].toLowerCase() === 'place') return { screen: 'PlaceDetails', params: { placeId: id } };
  return { screen: 'EventDetails', params: { occurrenceId: id } };
}
