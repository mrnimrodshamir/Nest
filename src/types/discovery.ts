import type { Activity } from '@/types/activity';
import type { FamilyFriendlyPlace } from '@/types/familyFriendlyPlace';

export type DiscoveryContentFilter = 'all' | 'activities' | 'places';

export type ActivityDiscoveryResult = Activity;
export type PlaceDiscoveryResult = FamilyFriendlyPlace;

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
    };

export type DiscoverySelection = Pick<DiscoveryItem, 'type' | 'id'> | null;

export interface DiscoveryCoordinate {
  latitude: number;
  longitude: number;
}
