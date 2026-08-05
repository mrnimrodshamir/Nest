import type { Activity } from '@/types/activity';
import type { FamilyFriendlyPlace } from '@/types/familyFriendlyPlace';
import type { PlaceViewport } from '@/types/familyFriendlyPlace';
import type { EventDetails } from '@/types/event';
import type {
  DiscoveryContentFilter,
  DiscoveryCoordinate,
  DiscoveryItem,
  DiscoverySelection,
} from '@/types/discovery';
import { distanceMeters } from '@/utils/placeViewport';

export function activityDiscoveryItem(activity: Activity): Extract<DiscoveryItem, { type: 'activity' }> {
  return { type: 'activity', id: activity.id, data: activity };
}

export function placeDiscoveryItem(place: FamilyFriendlyPlace): Extract<DiscoveryItem, { type: 'place' }> {
  return { type: 'place', id: place.id, data: place };
}

export function eventDiscoveryItem(event: EventDetails): Extract<DiscoveryItem, { type: 'event' }> {
  return { type: 'event', id: event.occurrence.id, data: event };
}

export function discoveryItemKey(item: Pick<DiscoveryItem, 'type' | 'id'>): string {
  return `${item.type}:${item.id}`;
}

export function discoverySelectionEquals(
  selection: DiscoverySelection,
  item: Pick<DiscoveryItem, 'type' | 'id'>,
): boolean {
  return selection?.type === item.type && selection.id === item.id;
}

export function filterDiscoveryItems(
  items: readonly DiscoveryItem[],
  filter: DiscoveryContentFilter,
): DiscoveryItem[] {
  if (filter === 'all') return [...items];
  const type = filter === 'activities' ? 'activity' : filter === 'places' ? 'place' : 'event';
  return items.filter((item) => item.type === type);
}

export function discoveryCoordinateInViewport(
  coordinate: DiscoveryCoordinate,
  viewport: PlaceViewport,
): boolean {
  return coordinate.latitude >= viewport.south && coordinate.latitude <= viewport.north
    && coordinate.longitude >= viewport.west && coordinate.longitude <= viewport.east;
}

/**
 * Distance is the only value shared honestly by Activities, Places, and Events. All
 * types are therefore ranked from the current map centre. Exact-distance ties
 * retain the natural domain order: Activity/Event start time or Place name, followed
 * by the typed stable key.
 *
 * When no valid centre exists, each type keeps its natural order (Activities
 * by upcoming start; Places by name) and the three lists are interleaved.
 */
export function mergeDiscoveryItems(
  activities: readonly Activity[],
  places: readonly FamilyFriendlyPlace[],
  events: readonly EventDetails[],
  origin?: DiscoveryCoordinate | null,
): DiscoveryItem[] {
  const activityItems = activities.map(activityDiscoveryItem);
  const placeItems = places.map(placeDiscoveryItem);
  const eventItems = events.map(eventDiscoveryItem);

  if (!isCoordinate(origin)) {
    const orderedActivities = [...activityItems].sort(
      (a, b) => new Date(a.data.startTime).getTime() - new Date(b.data.startTime).getTime() || a.id.localeCompare(b.id),
    );
    const orderedPlaces = [...placeItems].sort(
      (a, b) => a.data.name.localeCompare(b.data.name) || a.id.localeCompare(b.id),
    );
    const orderedEvents = [...eventItems].sort(
      (a, b) => Date.parse(a.data.occurrence.startsAt) - Date.parse(b.data.occurrence.startsAt) || a.id.localeCompare(b.id),
    );
    return interleave([orderedActivities, orderedPlaces, orderedEvents]);
  }

  return [...activityItems, ...placeItems, ...eventItems].sort((a, b) => {
    const distanceA = distanceMeters(origin, discoveryItemCoordinate(a));
    const distanceB = distanceMeters(origin, discoveryItemCoordinate(b));
    const distanceDifference = distanceA - distanceB;
    if (Math.abs(distanceDifference) > 0.01) return distanceDifference;
    if (a.type === 'activity' && b.type === 'activity') {
      const startDifference = new Date(a.data.startTime).getTime() - new Date(b.data.startTime).getTime();
      if (startDifference !== 0) return startDifference;
    }
    if (a.type === 'place' && b.type === 'place') {
      const nameDifference = a.data.name.localeCompare(b.data.name);
      if (nameDifference !== 0) return nameDifference;
    }
    if (a.type === 'event' && b.type === 'event') {
      const startDifference = Date.parse(a.data.occurrence.startsAt) - Date.parse(b.data.occurrence.startsAt);
      if (startDifference !== 0) return startDifference;
    }
    return discoveryItemKey(a).localeCompare(discoveryItemKey(b));
  });
}

export function discoveryItemCoordinate(item: DiscoveryItem): DiscoveryCoordinate {
  return item.type === 'event' ? item.data.location : item.data;
}

function interleave(groups: DiscoveryItem[][]): DiscoveryItem[] {
  const merged: DiscoveryItem[] = [];
  const length = Math.max(0, ...groups.map((group) => group.length));
  for (let index = 0; index < length; index += 1) {
    for (const group of groups) if (group[index]) merged.push(group[index]);
  }
  return merged;
}

function isCoordinate(value: DiscoveryCoordinate | null | undefined): value is DiscoveryCoordinate {
  return Boolean(
    value &&
      Number.isFinite(value.latitude) &&
      Number.isFinite(value.longitude) &&
      value.latitude >= -90 &&
      value.latitude <= 90 &&
      value.longitude >= -180 &&
      value.longitude <= 180,
  );
}
