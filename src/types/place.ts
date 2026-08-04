export type PlaceProvider = 'apple_maps' | null;

export type LocationSource = 'provider' | 'manual' | 'legacy';

export interface NormalizedPlace {
  name: string;
  formattedAddress: string | null;
  latitude: number;
  longitude: number;
  category: string | null;
  provider: PlaceProvider;
  providerPlaceId: string | null;
  source: LocationSource;
  wasAdjusted: boolean;
}

