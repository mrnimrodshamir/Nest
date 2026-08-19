import * as Location from 'expo-location';
import type { AppLocale } from '@/i18n/core';
import { invokePlaceSearch, type PlaceSearchLanguage } from '@/lib/placeSearchClient';
import { resolveLocalizedAddressCore } from './resolveLocalizedAddressCore';

const PLACE_SEARCH_LANGUAGES: readonly PlaceSearchLanguage[] = ['en', 'he', 'fr', 'ru'];

/** Apple's reverse-geocoding provider has no Arabic or Spanish language data
 *  yet (only en/he/fr/ru — see PlaceSearchLanguage). Arabic and Spanish users
 *  get an English-language address rather than a broken request; this is the
 *  same "provider content stays as supplied" behavior the app already has for
 *  places Apple has no Hebrew data for. */
function toPlaceSearchLanguage(locale: AppLocale): PlaceSearchLanguage {
  return (PLACE_SEARCH_LANGUAGES as readonly string[]).includes(locale) ? (locale as PlaceSearchLanguage) : 'en';
}

/** Resolves a human label for a coordinate in the app's current locale.
 *
 *  Apple's Maps Server API (already integrated for place search/autocomplete)
 *  supports a `lang` parameter that expo-location's on-device
 *  `reverseGeocodeAsync` does not expose — so that's the path used to get a
 *  Hebrew-localized address instead of the OS/device-locale address
 *  `Location.reverseGeocodeAsync` would return. Never translated or
 *  transliterated client-side: whatever Apple returns for the requested
 *  language is displayed as-is, including when that's an English address
 *  because Apple has no Hebrew data for that coordinate.
 *
 *  The on-device geocoder is kept as a fallback for when the network call
 *  itself fails (offline, edge function down) — same resilience behavior
 *  this picker always had — not as a locale strategy.
 *
 *  Thin wrapper only: the decision logic lives in resolveLocalizedAddressCore
 *  (pure, no expo-location import) so it can be unit-tested directly. */
export async function resolveLocalizedAddress(
  point: { latitude: number; longitude: number },
  locale: AppLocale,
): Promise<string | null> {
  return resolveLocalizedAddressCore(point, locale, {
    reverseGeocodeViaProvider: async (p, l) => {
      const result = await invokePlaceSearch({ action: 'reverse_geocode', center: p, language: toPlaceSearchLanguage(l as AppLocale) });
      return result.kind === 'address' ? result : { kind: result.kind, address: null };
    },
    reverseGeocodeOnDevice: (p) => Location.reverseGeocodeAsync(p),
  });
}
