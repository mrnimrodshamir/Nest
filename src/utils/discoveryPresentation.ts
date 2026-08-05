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
  return 'No activities or places found in this area.';
}

export function contentFilterIncludes(filter: DiscoveryContentFilter, type: 'activity' | 'place'): boolean {
  return filter === 'all' || (filter === 'activities' ? type === 'activity' : type === 'place');
}
