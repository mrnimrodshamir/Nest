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

/** Form/UI selection state. Coordinates always describe the current fixed
 * center pin, while `place` retains provider identity only when applicable. */
export interface SelectedActivityLocation {
  place: NormalizedPlace | null;
  latitude: number;
  longitude: number;
  displayName: string;
  addressLabel: string | null;
  source: LocationSource;
  wasAdjusted: boolean;
}
