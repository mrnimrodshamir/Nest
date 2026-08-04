import { supabase } from '@/lib/supabase';
import type { NormalizedPlace } from '@/types/place';

export type PlaceSearchAction = 'autocomplete' | 'search' | 'place_details';
export type PlaceSearchLanguage = 'en' | 'he';

export interface PlaceSearchCenter {
  latitude: number;
  longitude: number;
}

export type PlaceSearchRequest =
  | {
      action: 'autocomplete' | 'search';
      query: string;
      language?: PlaceSearchLanguage;
      countryCode?: string;
      center?: PlaceSearchCenter;
      limit?: number;
    }
  | {
      action: 'place_details';
      completionToken: string;
      language?: PlaceSearchLanguage;
      countryCode?: string;
      center?: PlaceSearchCenter;
      limit?: number;
    };

export interface PlaceSuggestion {
  name: string;
  formattedAddress: string | null;
  category: string | null;
  resolutionToken: string;
}

export type PlaceSearchResult =
  | { kind: 'suggestions'; suggestions: PlaceSuggestion[] }
  | { kind: 'places'; places: NormalizedPlace[] };

export type PlaceSearchErrorCode =
  | 'INVALID_REQUEST'
  | 'UNAUTHORIZED'
  | 'CONFIGURATION_MISSING'
  | 'RATE_LIMITED'
  | 'PROVIDER_UNAVAILABLE'
  | 'TIMEOUT'
  | 'MALFORMED_PROVIDER_RESPONSE';

export class PlaceSearchError extends Error {
  readonly code: PlaceSearchErrorCode;

  constructor(code: PlaceSearchErrorCode, message: string) {
    super(message);
    this.name = 'PlaceSearchError';
    this.code = code;
  }
}

export async function invokePlaceSearch(request: PlaceSearchRequest): Promise<PlaceSearchResult> {
  const { data, error } = await supabase.functions.invoke('search-apple-places', { body: request });
  if (error) throw await mapInvocationError(error);
  if (!isPlaceSearchResult(data)) {
    throw new PlaceSearchError('MALFORMED_PROVIDER_RESPONSE', 'Place search returned an invalid response.');
  }
  return data;
}

async function mapInvocationError(error: any): Promise<PlaceSearchError> {
  try {
    const payload = await error?.context?.json?.();
    const code = payload?.error?.code;
    const message = payload?.error?.message;
    if (isErrorCode(code) && typeof message === 'string') return new PlaceSearchError(code, message);
  } catch {
    // The function may be unreachable and have no JSON response.
  }
  return new PlaceSearchError('PROVIDER_UNAVAILABLE', 'Place search is temporarily unavailable.');
}

function isPlaceSearchResult(value: unknown): value is PlaceSearchResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Record<string, unknown>;
  if (result.kind === 'suggestions') return Array.isArray(result.suggestions);
  if (result.kind === 'places') return Array.isArray(result.places) && result.places.every(isNormalizedPlace);
  return false;
}

function isNormalizedPlace(value: unknown): value is NormalizedPlace {
  if (!value || typeof value !== 'object') return false;
  const place = value as Record<string, unknown>;
  return (
    typeof place.name === 'string' &&
    typeof place.latitude === 'number' && place.latitude >= -90 && place.latitude <= 90 &&
    typeof place.longitude === 'number' && place.longitude >= -180 && place.longitude <= 180 &&
    place.provider === 'apple_maps' && place.source === 'provider' && place.wasAdjusted === false
  );
}

function isErrorCode(value: unknown): value is PlaceSearchErrorCode {
  return [
    'INVALID_REQUEST', 'UNAUTHORIZED', 'CONFIGURATION_MISSING', 'RATE_LIMITED',
    'PROVIDER_UNAVAILABLE', 'TIMEOUT', 'MALFORMED_PROVIDER_RESPONSE',
  ].includes(String(value));
}

