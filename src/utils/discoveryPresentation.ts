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

export function discoveryEmptyCopy(selection: DiscoveryContentSelection): string {
  const keys = selectedContentKeys(selection);
  if (keys.length === 1 && keys[0] === 'activities') return 'No activities match these filters.';
  if (keys.length === 1 && keys[0] === 'places') return 'No places match these filters.';
  if (keys.length === 1 && keys[0] === 'events') return 'No events match these filters.';
  return 'No activities, places, or events found in this area.';
}

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
