import type { FamilyFriendlyPlace } from '@/types/familyFriendlyPlace';

export type PlaceCollectionType = 'standard' | 'featured_this_week' | 'editors_picks' | 'popular_places';

export interface PlaceCollection {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  coverImageUrl: string | null;
  collectionType: PlaceCollectionType;
  publishedAt: string;
  startsAt: string | null;
  endsAt: string | null;
  places: Array<{ place: FamilyFriendlyPlace; displayOrder: number }>;
}

export interface PlaceCollectionRow {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  cover_image_url: string | null;
  collection_type: PlaceCollectionType;
  published_at: string;
  starts_at: string | null;
  ends_at: string | null;
}

export type FeaturedPlaceSection = 'featured_this_week' | 'editors_picks' | 'new_places' | 'popular_places';
