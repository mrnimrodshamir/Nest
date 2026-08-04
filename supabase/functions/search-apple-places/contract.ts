export type PlaceSearchAction = 'autocomplete' | 'search' | 'place_details';
export type SupportedLanguage = 'en' | 'he';

export interface SearchCenter { latitude: number; longitude: number }

export interface PlaceSearchRequest {
  action: PlaceSearchAction;
  query?: string;
  language?: SupportedLanguage;
  countryCode?: string;
  center?: SearchCenter;
  limit?: number;
  completionToken?: string;
}

export interface NormalizedPlaceResponse {
  name: string;
  formattedAddress: string | null;
  latitude: number;
  longitude: number;
  category: string | null;
  provider: 'apple_maps';
  providerPlaceId: string | null;
  source: 'provider';
  wasAdjusted: false;
}

export interface PlaceSuggestionResponse {
  name: string;
  formattedAddress: string | null;
  category: string | null;
  resolutionToken: string;
}

export type PlaceSearchResponse =
  | { kind: 'suggestions'; suggestions: PlaceSuggestionResponse[] }
  | { kind: 'places'; places: NormalizedPlaceResponse[] };

export type PlaceErrorCode =
  | 'INVALID_REQUEST'
  | 'UNAUTHORIZED'
  | 'CONFIGURATION_MISSING'
  | 'RATE_LIMITED'
  | 'PROVIDER_UNAVAILABLE'
  | 'TIMEOUT'
  | 'MALFORMED_PROVIDER_RESPONSE';

export interface PlaceErrorResponse {
  error: { code: PlaceErrorCode; message: string };
}

