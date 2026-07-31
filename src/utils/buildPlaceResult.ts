export interface PlaceResult {
  id: string;
  name: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
}

/** Pure result-shaping logic, deliberately kept free of any expo-location
 *  import (unlike normalizePlaceResult.ts, which calls the real reverse-
 *  geocode API) so it's directly unit-testable without a native runtime. */
export function buildPlaceResult(
  point: { latitude: number; longitude: number },
  rawName: string | null | undefined,
  rawAddress: string | null | undefined,
  fallbackName: string,
  index: number,
): PlaceResult {
  return {
    id: `${point.latitude},${point.longitude},${index}`,
    name: rawName?.trim() || fallbackName,
    formattedAddress: rawAddress?.trim() ?? '',
    latitude: point.latitude,
    longitude: point.longitude,
  };
}
