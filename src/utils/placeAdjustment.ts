import type { NormalizedPlace } from '@/types/place';
import { isValidCoordinate } from '@/utils/normalizedPlace';

export const PLACE_ADJUSTMENT_TOLERANCE_METERS = 40;

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export function distanceMeters(from: Coordinates, to: Coordinates): number {
  if (!isValidCoordinate(from.latitude, from.longitude) || !isValidCoordinate(to.latitude, to.longitude)) {
    throw new RangeError('Invalid coordinates');
  }

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const earthRadiusMeters = 6_371_000;
  const latitudeDelta = toRadians(to.latitude - from.latitude);
  const longitudeDelta = toRadians(to.longitude - from.longitude);
  const fromLatitude = toRadians(from.latitude);
  const toLatitude = toRadians(to.latitude);
  const haversine =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(fromLatitude) * Math.cos(toLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return earthRadiusMeters * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function adjustProviderPlace(
  selectedPlace: NormalizedPlace,
  coordinates: Coordinates,
  displayName?: string | null,
  formattedAddress?: string | null,
): NormalizedPlace {
  const movedMeters = distanceMeters(selectedPlace, coordinates);
  if (movedMeters <= PLACE_ADJUSTMENT_TOLERANCE_METERS) {
    return { ...selectedPlace, ...coordinates };
  }

  const safeName = displayName?.trim() || 'Selected meeting point';
  const safeAddress = formattedAddress?.trim() || null;
  return {
    name: safeName,
    formattedAddress: safeAddress,
    ...coordinates,
    category: null,
    provider: null,
    providerPlaceId: null,
    source: 'manual',
    wasAdjusted: true,
  };
}

