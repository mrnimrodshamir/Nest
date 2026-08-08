import type { DiscoveryContentKey, DiscoveryContentSelection } from '@/types/discovery';

export const ALL_DISCOVERY_CONTENT: DiscoveryContentSelection = Object.freeze({ activities: true, places: true, events: true });

export function toggleDiscoveryContent(
  selection: DiscoveryContentSelection,
  key: DiscoveryContentKey,
): { selection: DiscoveryContentSelection; prevented: boolean } {
  const selectedCount = Object.values(selection).filter(Boolean).length;
  if (selection[key] && selectedCount === 1) return { selection, prevented: true };
  return { selection: { ...selection, [key]: !selection[key] }, prevented: false };
}

/** Returns a TRANSLATION KEY rather than a literal so the copy lives in one
 *  place and can be rendered in either language. Every one of the seven
 *  content combinations gets its own key, so a mixed selection reads naturally
 *  ("No activities or places…") instead of collapsing to a generic catch-all. */
export function discoveryEmptyCopyKey(selection: DiscoveryContentSelection): DiscoveryEmptyKey {
  const keys = selectedContentKeys(selection);
  const has = (key: DiscoveryContentKey) => keys.includes(key);
  if (keys.length === 1) {
    if (has('activities')) return 'discovery.empty.activities';
    if (has('places')) return 'discovery.empty.places';
    return 'discovery.empty.events';
  }
  if (keys.length === 2) {
    if (has('activities') && has('places')) return 'discovery.empty.activitiesPlaces';
    if (has('activities') && has('events')) return 'discovery.empty.activitiesEvents';
    return 'discovery.empty.placesEvents';
  }
  return 'discovery.empty.all';
}

export type DiscoveryEmptyKey =
  | 'discovery.empty.all'
  | 'discovery.empty.activities'
  | 'discovery.empty.places'
  | 'discovery.empty.events'
  | 'discovery.empty.activitiesPlaces'
  | 'discovery.empty.activitiesEvents'
  | 'discovery.empty.placesEvents';

export function contentSelectionIncludes(selection: DiscoveryContentSelection, type: 'activity' | 'place' | 'event'): boolean {
  return selection[type === 'activity' ? 'activities' : type === 'place' ? 'places' : 'events'];
}

export function selectedContentKeys(selection: DiscoveryContentSelection): DiscoveryContentKey[] {
  return (Object.keys(selection) as DiscoveryContentKey[]).filter((key) => selection[key]);
}

export function visibleDiscoveryFailures(
  selection: DiscoveryContentSelection,
  activityError: string | null,
  placeError: string | null,
  eventError: string | null = null,
): Array<'activity' | 'place' | 'event'> {
  const failures: Array<'activity' | 'place' | 'event'> = [];
  if (activityError && contentSelectionIncludes(selection, 'activity')) failures.push('activity');
  if (placeError && contentSelectionIncludes(selection, 'place')) failures.push('place');
  if (eventError && contentSelectionIncludes(selection, 'event')) failures.push('event');
  return failures;
}
