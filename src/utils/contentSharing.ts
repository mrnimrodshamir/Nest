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
  const lines = [`Discover ${input.name.trim()}`];
  if (input.location?.trim()) lines.push(input.location.trim());
  lines.push('', `Open in ${APP_NAME}:`, contentDeepLink('place', input.id));
  return lines.join('\n');
}

export function buildEventShareMessage(input: {
  occurrenceId: string;
  title: string;
  startsAt: string;
  location: string | null;
  status: 'scheduled' | 'cancelled' | 'postponed';
}): string {
  const date = new Date(input.startsAt);
  const state = input.status === 'cancelled' ? 'Cancelled: ' : input.status === 'postponed' ? 'Postponed: ' : '';
  const lines = [`${state}${input.title.trim()}`];
  if (!Number.isNaN(date.getTime())) lines.push(date.toLocaleString(undefined, {
    weekday: 'long', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Jerusalem',
  }));
  if (input.location?.trim()) lines.push(input.location.trim());
  lines.push('', `Open in ${APP_NAME}:`, contentDeepLink('event', input.occurrenceId));
  return lines.join('\n');
}

export function buildWhatsAppUrl(message: string): string {
  return `whatsapp://send?text=${encodeURIComponent(message)}`;
}

export type SharedContentRoute =
  | { screen: 'ActivityDetail'; params: { activityId: string } }
  | { screen: 'PlaceDetails'; params: { placeId: string } }
  | { screen: 'EventDetails'; params: { occurrenceId: string } }
  /** Forums reuse the Chat screen; `forumKey` is the stable catalogue slug,
   *  resolved to a chat id (and joined) on open. */
  | { screen: 'Chat'; params: { kind: 'forum'; forumKey: string } };

/** Parses canonical and legacy custom-scheme links without accepting arbitrary
 *  routes. `forum` is a distinct path segment, so forum links can never
 *  collide with the existing activity/place/event links. */
export function parseSharedContentUrl(value: string): SharedContentRoute | null {
  const match = /^(?:nestup|momzi):\/\/(activity|place|event|forum)\/([^/?#]+)(?:[?#].*)?$/i.exec(value.trim());
  if (!match) return null;
  let id: string;
  try { id = decodeURIComponent(match[2]); } catch { return null; }
  if (!id.trim()) return null;
  const kind = match[1].toLowerCase();
  if (kind === 'activity') return { screen: 'ActivityDetail', params: { activityId: id } };
  if (kind === 'place') return { screen: 'PlaceDetails', params: { placeId: id } };
  if (kind === 'forum') return { screen: 'Chat', params: { kind: 'forum', forumKey: id } };
  return { screen: 'EventDetails', params: { occurrenceId: id } };
}
