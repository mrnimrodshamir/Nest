import {
  isPlaceCategory,
  type FamilyFriendlyPlace,
  type FamilyFriendlyPlaceRow,
  type PlaceVerificationStatus,
} from '@/types/familyFriendlyPlace';

export function mapFamilyFriendlyPlaceRow(row: FamilyFriendlyPlaceRow): FamilyFriendlyPlace {
  if (!isPlaceCategory(row.category)) throw new Error(`Unsupported place category: ${row.category}`);
  if (!Number.isFinite(row.latitude) || row.latitude < -90 || row.latitude > 90) throw new Error('Invalid place latitude');
  if (!Number.isFinite(row.longitude) || row.longitude < -180 || row.longitude > 180) throw new Error('Invalid place longitude');

  return {
    id: row.id, name: row.name, slug: row.slug, category: row.category,
    shortDescription: row.short_description, fullDescription: row.full_description,
    latitude: row.latitude, longitude: row.longitude,
    formattedAddress: row.formatted_address, neighborhood: row.neighborhood,
    city: row.city, countryCode: row.country_code, provider: row.provider,
    providerPlaceId: row.provider_place_id, websiteUrl: row.website_url, phone: row.phone,
    coverImageUrl: row.cover_image_url, galleryImageUrls: row.gallery_image_urls,
    isIndoor: row.is_indoor, isOutdoor: row.is_outdoor, isFree: row.is_free,
    priceNote: row.price_note, minAgeMonths: row.min_age_months, maxAgeMonths: row.max_age_months,
    strollerFriendly: row.stroller_friendly, changingTable: row.changing_table,
    highChairs: row.high_chairs, toilets: row.toilets, shade: row.shade,
    waterFountain: row.water_fountain, accessible: row.accessible,
    parkingNote: row.parking_note, openingHours: row.opening_hours,
    sourceName: row.source_name, sourceUrl: row.source_url,
    verificationStatus: row.verification_status as PlaceVerificationStatus,
    lastVerifiedAt: row.last_verified_at, isActive: row.is_active,
    distanceMeters: row.distance_meters ?? null,
  };
}

export function formatPlaceDistance(distanceMeters: number | null): string | null {
  if (distanceMeters === null || !Number.isFinite(distanceMeters) || distanceMeters < 0) return null;
  if (distanceMeters < 1000) return `${Math.round(distanceMeters / 10) * 10} m away`;
  return `${(distanceMeters / 1000).toFixed(1)} km away`;
}

export function placeSummaryFeatures(place: FamilyFriendlyPlace): string[] {
  const features: string[] = [];
  if (place.shade) features.push('Shade');
  if (place.toilets) features.push('Toilets');
  if (place.strollerFriendly) features.push('Stroller friendly');
  if (place.changingTable) features.push('Changing table');
  if (place.highChairs) features.push('High chairs');
  if (place.accessible) features.push('Accessible');
  if (place.waterFountain) features.push('Water fountain');
  return features.slice(0, 3);
}
