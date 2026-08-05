import type { FamilyFriendlyPlaceRow } from '@/types/familyFriendlyPlace';
import type { PlaceCollection, PlaceCollectionRow } from '@/types/placeCollection';
import { mapFamilyFriendlyPlaceRow } from '@/utils/familyFriendlyPlace';

export interface PlaceCollectionItemRow {
  display_order: number;
  places: FamilyFriendlyPlaceRow | FamilyFriendlyPlaceRow[];
}

export function mapPlaceCollection(row: PlaceCollectionRow, items: PlaceCollectionItemRow[]): PlaceCollection {
  return {
    id: row.id, title: row.title, slug: row.slug, description: row.description,
    coverImageUrl: row.cover_image_url, collectionType: row.collection_type,
    publishedAt: row.published_at, startsAt: row.starts_at, endsAt: row.ends_at,
    places: items.flatMap((item) => {
      const place = Array.isArray(item.places) ? item.places[0] : item.places;
      return place ? [{ place: mapFamilyFriendlyPlaceRow(place), displayOrder: item.display_order }] : [];
    }).sort((a, b) => a.displayOrder - b.displayOrder || a.place.name.localeCompare(b.place.name)),
  };
}

export function isPlaceCollectionVisible(collection: Pick<PlaceCollection, 'publishedAt' | 'startsAt' | 'endsAt'>, now = new Date()): boolean {
  const timestamp = now.getTime();
  return new Date(collection.publishedAt).getTime() <= timestamp
    && (collection.startsAt == null || new Date(collection.startsAt).getTime() <= timestamp)
    && (collection.endsAt == null || new Date(collection.endsAt).getTime() > timestamp);
}
