import type { Activity } from '@/types/activity';
import type { FamilyFriendlyPlace } from '@/types/familyFriendlyPlace';
import type { PlaceViewport } from '@/types/familyFriendlyPlace';
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
  const type = filter === 'activities' ? 'activity' : 'place';
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
 * Distance is the only value shared honestly by Activities and Places. Both
 * types are therefore ranked from the current map centre. Exact-distance ties
 * retain the natural domain order: Activity start time or Place name, followed
 * by the typed stable key.
 *
 * When no valid centre exists, each type keeps its natural order (Activities
 * by upcoming start; Places by name) and the two lists are interleaved.
 */
export function mergeDiscoveryItems(
  activities: readonly Activity[],
  places: readonly FamilyFriendlyPlace[],
  origin?: DiscoveryCoordinate | null,
): DiscoveryItem[] {
  const activityItems = activities.map(activityDiscoveryItem);
  const placeItems = places.map(placeDiscoveryItem);

  if (!isCoordinate(origin)) {
    const orderedActivities = [...activityItems].sort(
      (a, b) => new Date(a.data.startTime).getTime() - new Date(b.data.startTime).getTime() || a.id.localeCompare(b.id),
    );
    const orderedPlaces = [...placeItems].sort(
      (a, b) => a.data.name.localeCompare(b.data.name) || a.id.localeCompare(b.id),
    );
    return interleave(orderedActivities, orderedPlaces);
  }

  return [...activityItems, ...placeItems].sort((a, b) => {
    const distanceA = distanceMeters(origin, a.data);
    const distanceB = distanceMeters(origin, b.data);
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
    return discoveryItemKey(a).localeCompare(discoveryItemKey(b));
  });
}

function interleave(activities: DiscoveryItem[], places: DiscoveryItem[]): DiscoveryItem[] {
  const merged: DiscoveryItem[] = [];
  const length = Math.max(activities.length, places.length);
  for (let index = 0; index < length; index += 1) {
    if (activities[index]) merged.push(activities[index]);
    if (places[index]) merged.push(places[index]);
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
