import type { Activity } from '@/types/activity';
import type { FamilyFriendlyPlace } from '@/types/familyFriendlyPlace';
import type { EventDetails } from '@/types/event';

export type DiscoveryContentKey = 'activities' | 'places' | 'events';
export type DiscoveryContentSelection = Record<DiscoveryContentKey, boolean>;
export type DiscoverySort = 'default' | 'distance' | 'soonest' | 'newest' | 'alphabetical';

export type ActivityDiscoveryResult = Activity;
export type PlaceDiscoveryResult = FamilyFriendlyPlace;
export type EventDiscoveryResult = EventDetails;

export type DiscoveryItem =
  | {
      type: 'activity';
      id: string;
      data: ActivityDiscoveryResult;
    }
  | {
      type: 'place';
      id: string;
      data: PlaceDiscoveryResult;
    }
  | {
      type: 'event';
      id: string;
      data: EventDiscoveryResult;
    };

export type DiscoverySelection = Pick<DiscoveryItem, 'type' | 'id'> | null;

export interface DiscoveryCoordinate {
  latitude: number;
  longitude: number;
}
