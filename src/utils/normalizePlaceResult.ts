import * as Location from 'expo-location';
import { buildPlaceResult, type PlaceResult } from './buildPlaceResult';

export type { PlaceResult } from './buildPlaceResult';

/** Turns one raw expo-location geocode candidate into a PlaceResult ready
 *  for display — reverse-geocodes it for a human name/address, falling
 *  back to the mother's own typed query text if that comes back empty
 *  (coordinates are still valid either way, so a result is never dropped
 *  just because reverse geocoding didn't find a name for it). The actual
 *  shape-building logic lives in buildPlaceResult.ts (pure, no
 *  expo-location import) so it can be unit-tested directly. */
export async function normalizePlaceResult(
  point: { latitude: number; longitude: number },
  query: string,
  index: number,
): Promise<PlaceResult> {
  let name: string | null = null;
  let address: string | null = null;
  try {
    const reverse = await Location.reverseGeocodeAsync(point);
    const place = reverse[0];
    if (place) {
      name = place.name ?? null;
      address = [place.street, place.city].filter(Boolean).join(', ') || null;
    }
  } catch {
    // Reverse geocoding failing is non-fatal — the coordinates the search
    // already resolved are still good; only the label falls back.
  }
  return buildPlaceResult(point, name, address, query, index);
}
