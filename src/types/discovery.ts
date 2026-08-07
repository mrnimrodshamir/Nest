import type { Activity } from '@/types/activity';
import type { FamilyFriendlyPlace } from '@/types/familyFriendlyPlace';
import type { EventDetails } from '@/types/event';

export type DiscoveryContentKey = 'activities' | 'places' | 'events';
export type DiscoveryContentSelection = Record<DiscoveryContentKey, boolean>;
/** `newest` was removed deliberately. Activities carry no creation timestamp
 *  at all, so it silently ranked them by start time (furthest-future first),
 *  and Places fell back to a sentinel that floated UNVERIFIED entries to the
 *  top. It was correct for Events only — one of three visible content types. */
export type DiscoverySort = 'default' | 'distance' | 'soonest' | 'alphabetical';

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
