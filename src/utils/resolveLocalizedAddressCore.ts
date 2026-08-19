import { dedupeAddressLabel } from './reverseGeocodeAddress';

export interface ProviderReverseGeocodeResult {
  kind: string;
  address: { formattedAddress: string; latitude: number; longitude: number } | null;
}

export interface ResolveLocalizedAddressCoreDependencies {
  reverseGeocodeViaProvider: (point: { latitude: number; longitude: number }, locale: string) => Promise<ProviderReverseGeocodeResult>;
  reverseGeocodeOnDevice: (point: { latitude: number; longitude: number }) => Promise<Array<{ name?: string | null; street?: string | null }>>;
}

/** Pure decision logic for resolveLocalizedAddress, deliberately kept free of
 *  any expo-location or Supabase import (unlike resolveLocalizedAddress.ts,
 *  which wires the real implementations) so it's directly unit-testable —
 *  see buildPlaceResult.ts/normalizePlaceResult.ts for the same split. */
export async function resolveLocalizedAddressCore(
  point: { latitude: number; longitude: number },
  locale: string,
  dependencies: ResolveLocalizedAddressCoreDependencies,
): Promise<string | null> {
  try {
    const result = await dependencies.reverseGeocodeViaProvider(point, locale);
    if (result.kind === 'address' && result.address) return result.address.formattedAddress;
  } catch {
    // Falls through to the on-device geocoder below.
  }
  try {
    const results = await dependencies.reverseGeocodeOnDevice(point);
    const place = results[0];
    if (!place) return null;
    return dedupeAddressLabel(place.name, place.street);
  } catch {
    return null;
  }
}
