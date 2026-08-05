import type { Region } from 'react-native-maps';
import type { DiscoveryContentFilter, DiscoverySelection } from '@/types/discovery';

export interface DiscoveryFilterTransition {
  contentFilter: DiscoveryContentFilter;
  selectedItem: DiscoverySelection;
  region: Region;
}

/** Content filtering is presentation-only: selection clears, camera persists. */
export function transitionDiscoveryContentFilter(
  region: Region,
  contentFilter: DiscoveryContentFilter,
): DiscoveryFilterTransition {
  return { region, contentFilter, selectedItem: null };
}

export function discoveryEmptyCopy(filter: DiscoveryContentFilter): string {
  if (filter === 'activities') return 'No activities match these filters.';
  if (filter === 'places') return 'No places match these filters.';
  if (filter === 'events') return 'No events match these filters.';
  return 'No activities, places, or events found in this area.';
}

export function contentFilterIncludes(filter: DiscoveryContentFilter, type: 'activity' | 'place' | 'event'): boolean {
  return filter === 'all'
    || (filter === 'activities' && type === 'activity')
    || (filter === 'places' && type === 'place')
    || (filter === 'events' && type === 'event');
}

export function visibleDiscoveryFailures(
  filter: DiscoveryContentFilter,
  activityError: string | null,
  placeError: string | null,
  eventError: string | null = null,
): Array<'activity' | 'place' | 'event'> {
  const failures: Array<'activity' | 'place' | 'event'> = [];
  if (activityError && contentFilterIncludes(filter, 'activity')) failures.push('activity');
  if (placeError && contentFilterIncludes(filter, 'place')) failures.push('place');
  if (eventError && contentFilterIncludes(filter, 'event')) failures.push('event');
  return failures;
}
