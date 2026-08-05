import type { ActivityFormSeedValues } from '@/components/ActivityForm';
import type { ActivityCategory } from '@/types/activity';
import type { FamilyFriendlyPlace, PlaceCategory } from '@/types/familyFriendlyPlace';

const SUGGESTED_ACTIVITY_CATEGORY: Partial<Record<PlaceCategory, ActivityCategory>> = {
  playground: 'playground_meetup', indoor_playground: 'indoor_playground',
  park: 'stroller_walk', picnic_area: 'picnic', library: 'story_time', pool: 'swimming',
  museum: 'museum', beach: 'beach', zoo_or_animals: 'zoo',
};

export function activityCategoryForPlace(category: PlaceCategory): ActivityCategory {
  return SUGGESTED_ACTIVITY_CATEGORY[category] ?? 'other';
}

export function buildActivitySeedFromPlace(place: FamilyFriendlyPlace): ActivityFormSeedValues {
  const provider = place.provider === 'apple_maps' ? 'apple_maps' as const : null;
  const source = provider && place.providerPlaceId ? 'provider' as const : 'manual' as const;
  const normalized = {
    name: place.name, formattedAddress: place.formattedAddress, latitude: place.latitude, longitude: place.longitude,
    category: place.category, provider, providerPlaceId: source === 'provider' ? place.providerPlaceId : null,
    source, wasAdjusted: false,
  };
  return {
    activityType: activityCategoryForPlace(place.category), description: '', durationMinutes: 60,
    latitude: place.latitude, longitude: place.longitude, locationName: place.name,
    selectedLocation: {
      place: normalized,
      latitude: normalized.latitude,
      longitude: normalized.longitude,
      displayName: normalized.name,
      addressLabel: normalized.formattedAddress,
      source: normalized.source,
      wasAdjusted: false,
    },
    maxParticipants: 8,
    babyMinAgeMonths: place.minAgeMonths, babyMaxAgeMonths: place.maxAgeMonths, notes: '', coverImageUrl: null,
  };
}
