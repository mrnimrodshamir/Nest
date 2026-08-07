import type { Activity } from '@/types/activity';
import type { FamilyFriendlyPlace } from '@/types/familyFriendlyPlace';
import type { PlaceViewport } from '@/types/familyFriendlyPlace';
import type { EventDetails } from '@/types/event';
import type {
  DiscoveryContentSelection,
  DiscoveryCoordinate,
  DiscoveryItem,
  DiscoverySelection,
  DiscoverySort,
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
  selection: DiscoveryContentSelection,
): DiscoveryItem[] {
  return items.filter((item) => selection[item.type === 'activity' ? 'activities' : item.type === 'place' ? 'places' : 'events']);
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

/** Sorts list presentation only. Map callers keep using the unsorted item set. */
export function sortDiscoveryItems(
  items: readonly DiscoveryItem[],
  sort: DiscoverySort,
  origin?: DiscoveryCoordinate | null,
): DiscoveryItem[] {
  if (sort === 'default') {
    const activities = items.filter((item): item is Extract<DiscoveryItem, { type: 'activity' }> => item.type === 'activity')
      .sort((a, b) => Date.parse(a.data.startTime) - Date.parse(b.data.startTime));
    const places = items.filter((item): item is Extract<DiscoveryItem, { type: 'place' }> => item.type === 'place')
      .sort((a, b) => distanceFor(a, origin) - distanceFor(b, origin) || a.data.name.localeCompare(b.data.name));
    const events = items.filter((item): item is Extract<DiscoveryItem, { type: 'event' }> => item.type === 'event')
      .sort((a, b) => Date.parse(a.data.occurrence.startsAt) - Date.parse(b.data.occurrence.startsAt));
    return interleave([activities, places, events]);
  }
  return [...items].sort((a, b) => {
    if (sort === 'distance') return distanceFor(a, origin) - distanceFor(b, origin) || discoveryItemKey(a).localeCompare(discoveryItemKey(b));
    if (sort === 'alphabetical') return titleFor(a).localeCompare(titleFor(b)) || discoveryItemKey(a).localeCompare(discoveryItemKey(b));
    return startTimeFor(a) - startTimeFor(b) || discoveryItemKey(a).localeCompare(discoveryItemKey(b));
  });
}

function distanceFor(item: DiscoveryItem, origin?: DiscoveryCoordinate | null): number {
  if (!isCoordinate(origin)) return Number.MAX_SAFE_INTEGER;
  return distanceMeters(origin, discoveryItemCoordinate(item));
}

function titleFor(item: DiscoveryItem): string {
  return item.type === 'place' ? item.data.name : item.data.title;
}

/** Start time for `soonest`. Places have no start time and are not scheduled
 *  at all, so they sort to the end rather than being given a fabricated one. */
function startTimeFor(item: DiscoveryItem): number {
  if (item.type === 'activity') return Date.parse(item.data.startTime);
  if (item.type === 'event') return Date.parse(item.data.occurrence.startsAt);
  return Number.MAX_SAFE_INTEGER;
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
