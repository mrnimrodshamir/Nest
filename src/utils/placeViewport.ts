import type { PlaceQueryInput, PlaceViewport } from '@/types/familyFriendlyPlace';

export const MAX_PLACE_RESULTS = 100;

export function regionToPlaceViewport(region: {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}): PlaceViewport {
  return {
    north: Math.min(90, region.latitude + region.latitudeDelta / 2),
    south: Math.max(-90, region.latitude - region.latitudeDelta / 2),
    east: Math.min(180, region.longitude + region.longitudeDelta / 2),
    west: Math.max(-180, region.longitude - region.longitudeDelta / 2),
  };
}

export function validatePlaceQueryInput(input: PlaceQueryInput): Required<Pick<PlaceQueryInput, 'viewport' | 'limit'>> {
  const { north, south, east, west } = input.viewport;
  if (![north, south, east, west].every(Number.isFinite)) throw new Error('Invalid map viewport');
  if (north <= south || east <= west || north > 90 || south < -90 || east > 180 || west < -180) {
    throw new Error('Invalid map viewport');
  }
  return { viewport: input.viewport, limit: Math.max(1, Math.min(input.limit ?? 80, MAX_PLACE_RESULTS)) };
}

export function distanceMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const radians = (value: number) => (value * Math.PI) / 180;
  const dLat = radians(to.latitude - from.latitude);
  const dLng = radians(to.longitude - from.longitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(radians(from.latitude)) * Math.cos(radians(to.latitude)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
