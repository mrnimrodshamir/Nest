import {
  isPlaceCategory,
  type FamilyFriendlyPlace,
  type FamilyFriendlyPlaceRow,
  type PlaceVerificationStatus,
} from '@/types/familyFriendlyPlace';
import type { PlaceFilters } from '@/types/familyFriendlyPlace';
import type { Translator } from '@/i18n/taxonomy';
import { placeCategoryLabel } from '@/i18n/taxonomy';
import { currentAppLocale, translate, type AppLocale } from '@/i18n/core';

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

export function formatPlaceDistance(distanceMeters: number | null, t?: Translator): string | null {
  if (distanceMeters === null || !Number.isFinite(distanceMeters) || distanceMeters < 0) return null;
  if (distanceMeters < 1000) {
    const count = Math.round(distanceMeters / 10) * 10;
    return t ? t('place.distance.meters', { count }) : `${count} m away`;
  }
  const count = (distanceMeters / 1000).toFixed(1);
  return t ? t('place.distance.kilometers', { count }) : `${count} km away`;
}

export function placeSummaryFeatures(place: FamilyFriendlyPlace, limit = 3, t?: Translator): string[] {
  const features: string[] = [];
  const label = (key: Parameters<Translator>[0], fallback: string) => t ? t(key) : fallback;
  if (place.shade) features.push(label('place.fact.shade', 'Shade'));
  if (place.toilets) features.push(label('place.fact.toilets', 'Toilets'));
  if (place.strollerFriendly) features.push(label('place.fact.stroller', 'Stroller friendly'));
  if (place.changingTable) features.push(label('place.fact.changingTable', 'Changing table'));
  if (place.highChairs) features.push(label('place.fact.highChairs', 'High chairs'));
  if (place.accessible) features.push(label('place.fact.accessible', 'Accessible'));
  if (place.waterFountain) features.push(label('place.fact.water', 'Water fountain'));
  return features.slice(0, limit);
}

/** Caregiver-facing, known-values-only facts for Place Details. */
export function placeWhatIsHere(place: FamilyFriendlyPlace, t?: Translator, locale: AppLocale = currentAppLocale()): string[] {
  const facts: string[] = [];
  const categoryLabels: Partial<Record<FamilyFriendlyPlace['category'], string>> = {
    playground: 'Playground', park: 'Park', indoor_playground: 'Indoor play area',
    zoo_or_animals: 'Animals', museum: 'Museum', library: 'Library',
    beach: 'Beach access', pool: 'Pool', community_center: 'Community center',
    attraction: 'Attraction', picnic_area: 'Picnic area',
  };
  const category = t ? placeCategoryLabel(place.category, t) : categoryLabels[place.category];
  if (category) facts.push(category);
  const label = (key: Parameters<Translator>[0], fallback: string) => t ? t(key) : fallback;
  if (place.isIndoor === true) facts.push(label('place.fact.indoor', 'Indoor'));
  if (place.isOutdoor === true) facts.push(label('place.fact.outdoor', 'Outdoor'));
  if (place.isFree === true) facts.push(label('place.fact.free', 'Free'));
  if (place.isFree === false) facts.push(label('place.fact.paid', 'Paid'));
  if (place.toilets === true) facts.push(label('place.fact.toilets', 'Toilets'));
  if (place.shade === true) facts.push(label('place.fact.shade', 'Shade'));
  if (place.waterFountain === true) facts.push(label('place.fact.water', 'Water fountain'));
  if (place.changingTable === true) facts.push(label('place.fact.changingTable', 'Changing table'));
  if (place.strollerFriendly === true) facts.push(label('place.fact.stroller', 'Stroller friendly'));
  if (place.accessible === true) facts.push(label('place.fact.accessible', 'Accessible'));
  if (place.minAgeMonths != null || place.maxAgeMonths != null) {
    const text: Translator = t ?? ((key, params) => translate('en', key, params));
    facts.push(text('place.fact.bestFor', {
      age: formatPlaceAgeRange(place.minAgeMonths, place.maxAgeMonths, locale),
    }));
  }
  return facts;
}

export function placeMatchesFilters(place: FamilyFriendlyPlace, filters: PlaceFilters): boolean {
  if (!place.isActive || place.verificationStatus !== 'verified') return false;
  if (filters.category && place.category !== filters.category) return false;
  if (filters.environment === 'indoor' && place.isIndoor !== true) return false;
  if (filters.environment === 'outdoor' && place.isOutdoor !== true) return false;
  if (filters.cost === 'free' && place.isFree !== true) return false;
  if (filters.cost === 'paid' && place.isFree !== false) return false;
  if (filters.changingTable && place.changingTable !== true) return false;
  if (filters.toilets && place.toilets !== true) return false;
  if (filters.highChairs && place.highChairs !== true) return false;
  if (filters.shade && place.shade !== true) return false;
  if (filters.waterFountain && place.waterFountain !== true) return false;
  if (filters.accessible && place.accessible !== true) return false;
  if (filters.ageMonths != null) {
    if (place.minAgeMonths != null && place.minAgeMonths > filters.ageMonths) return false;
    if (place.maxAgeMonths != null && place.maxAgeMonths < filters.ageMonths) return false;
  }
  if (filters.maxDistanceMeters != null && (place.distanceMeters == null || place.distanceMeters > filters.maxDistanceMeters)) return false;
  return true;
}

export function formatPlaceAgeRange(min: number | null, max: number | null, locale: AppLocale = currentAppLocale()): string {
  if (min == null && max == null) return translate(locale, 'place.age.any');
  const label = (months: number) => {
    if (months < 24) {
      if (locale === 'he' && months === 1) return 'חודש';
      if (locale === 'he' && months === 2) return 'חודשיים';
      return translate(locale, 'place.age.months', { count: months });
    }
    const years = Math.floor(months / 12);
    if (locale === 'he' && years === 1) return 'שנה';
    if (locale === 'he' && years === 2) return 'שנתיים';
    return translate(locale, 'place.age.years', { count: years });
  };
  if (min == null) return translate(locale, 'place.age.upTo', { age: label(max!) });
  if (max == null) return translate(locale, 'place.age.andUp', { age: label(min) });
  return translate(locale, 'place.age.range', { min: label(min), max: label(max) });
}

export function formatOpeningHours(value: Record<string, unknown> | null): string | null {
  if (!value) return null;
  const entries = Object.entries(value).flatMap(([day, hours]) => {
    if (typeof hours === 'string') return [`${day}: ${hours}`];
    if (Array.isArray(hours) && hours.every((item) => typeof item === 'string')) return [`${day}: ${hours.join(', ')}`];
    return [];
  });
  return entries.length ? entries.join('\n') : null;
}

export function buildAppleMapsPlaceUrl(place: Pick<FamilyFriendlyPlace, 'name' | 'latitude' | 'longitude'>): string {
  if (!Number.isFinite(place.latitude) || place.latitude < -90 || place.latitude > 90) throw new Error('Invalid place latitude');
  if (!Number.isFinite(place.longitude) || place.longitude < -180 || place.longitude > 180) throw new Error('Invalid place longitude');
  return `https://maps.apple.com/?ll=${place.latitude},${place.longitude}&q=${encodeURIComponent(place.name)}`;
}
