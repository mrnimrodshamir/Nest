import type { Activity } from '@/types/activity';
import type { FamilyFriendlyPlace } from '@/types/familyFriendlyPlace';
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

/**
 * Distance is the only value shared honestly by Activities and Places. Both
 * types are therefore ranked from the current map centre. A deterministic
 * adjustment of at most five metres breaks near-ties without claiming useful
 * precision or grouping every item of one type together.
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
    const adjustedA = distanceA + nearTieAdjustment(a);
    const adjustedB = distanceB + nearTieAdjustment(b);
    return adjustedA - adjustedB || discoveryItemKey(a).localeCompare(discoveryItemKey(b));
  });
}

function nearTieAdjustment(item: DiscoveryItem): number {
  let hash = item.type === 'activity' ? 17 : 31;
  for (const character of item.id) hash = (hash * 33 + character.charCodeAt(0)) >>> 0;
  return (hash % 11) - 5;
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
