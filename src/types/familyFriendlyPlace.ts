export const PLACE_CATEGORIES = [
  'playground',
  'park',
  'indoor_playground',
  'zoo_or_animals',
  'museum',
  'library',
  'beach',
  'pool',
  'community_center',
  'attraction',
  'picnic_area',
  'other',
] as const;

export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];
export type PlaceVerificationStatus = 'draft' | 'verified' | 'needs_review' | 'archived';

export const PLACE_CATEGORY_LABELS: Record<PlaceCategory, string> = {
  playground: 'Playground',
  park: 'Park',
  indoor_playground: 'Indoor play',
  zoo_or_animals: 'Animals',
  museum: 'Museum',
  library: 'Library',
  beach: 'Beach',
  pool: 'Pool',
  community_center: 'Community center',
  attraction: 'Attraction',
  picnic_area: 'Picnic area',
  other: 'Other',
};

export interface FamilyFriendlyPlace {
  id: string;
  name: string;
  slug: string;
  category: PlaceCategory;
  shortDescription: string | null;
  fullDescription: string | null;
  latitude: number;
  longitude: number;
  formattedAddress: string | null;
  neighborhood: string | null;
  city: string;
  countryCode: string;
  provider: string | null;
  providerPlaceId: string | null;
  websiteUrl: string | null;
  phone: string | null;
  coverImageUrl: string | null;
  galleryImageUrls: string[] | null;
  isIndoor: boolean | null;
  isOutdoor: boolean | null;
  isFree: boolean | null;
  priceNote: string | null;
  minAgeMonths: number | null;
  maxAgeMonths: number | null;
  strollerFriendly: boolean | null;
  changingTable: boolean | null;
  highChairs: boolean | null;
  toilets: boolean | null;
  shade: boolean | null;
  waterFountain: boolean | null;
  accessible: boolean | null;
  parkingNote: string | null;
  openingHours: Record<string, unknown> | null;
  sourceName: string | null;
  sourceUrl: string | null;
  verificationStatus: PlaceVerificationStatus;
  lastVerifiedAt: string | null;
  isActive: boolean;
  distanceMeters: number | null;
}

export interface FamilyFriendlyPlaceRow {
  id: string;
  name: string;
  slug: string;
  category: string;
  short_description: string | null;
  full_description: string | null;
  latitude: number;
  longitude: number;
  formatted_address: string | null;
  neighborhood: string | null;
  city: string;
  country_code: string;
  provider: string | null;
  provider_place_id: string | null;
  website_url: string | null;
  phone: string | null;
  cover_image_url: string | null;
  gallery_image_urls: string[] | null;
  is_indoor: boolean | null;
  is_outdoor: boolean | null;
  is_free: boolean | null;
  price_note: string | null;
  min_age_months: number | null;
  max_age_months: number | null;
  stroller_friendly: boolean | null;
  changing_table: boolean | null;
  high_chairs: boolean | null;
  toilets: boolean | null;
  shade: boolean | null;
  water_fountain: boolean | null;
  accessible: boolean | null;
  parking_note: string | null;
  opening_hours: Record<string, unknown> | null;
  source_name: string | null;
  source_url: string | null;
  verification_status: string;
  last_verified_at: string | null;
  is_active: boolean;
  distance_meters?: number | null;
}

export interface PlaceViewport {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface PlaceFilters {
  category?: PlaceCategory | null;
  environment?: 'indoor' | 'outdoor' | null;
  cost?: 'free' | 'paid' | null;
  ageMonths?: number | null;
  changingTable?: boolean | null;
  toilets?: boolean | null;
  highChairs?: boolean | null;
  shade?: boolean | null;
  waterFountain?: boolean | null;
  accessible?: boolean | null;
  maxDistanceMeters?: number | null;
  /** Reserved until opening hours are normalized into a timezone-aware contract. */
  openNow?: boolean | null;
}

export interface PlaceQueryInput {
  viewport: PlaceViewport;
  filters?: PlaceFilters;
  userCoordinate?: { latitude: number; longitude: number } | null;
  limit?: number;
  page?: number;
}

export function isPlaceCategory(value: string): value is PlaceCategory {
  return (PLACE_CATEGORIES as readonly string[]).includes(value);
}
