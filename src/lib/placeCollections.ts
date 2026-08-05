import { supabase } from '@/lib/supabase';
import { PLACE_COLUMNS } from '@/lib/familyFriendlyPlaces';
import type { FamilyFriendlyPlaceRow } from '@/types/familyFriendlyPlace';
import type { PlaceCollection, PlaceCollectionRow, PlaceCollectionType } from '@/types/placeCollection';
import { mapPlaceCollection, type PlaceCollectionItemRow } from '@/utils/placeCollections';

export async function queryPlaceCollections(type?: PlaceCollectionType, limit = 20): Promise<PlaceCollection[]> {
  let query = supabase.from('place_collections').select('id,title,slug,description,cover_image_url,collection_type,published_at,starts_at,ends_at').eq('is_active', true).not('published_at', 'is', null).order('published_at', { ascending: false }).limit(Math.max(1, Math.min(limit, 50)));
  if (type) query = query.eq('collection_type', type);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  const rows = (data ?? []) as unknown as PlaceCollectionRow[];
  return Promise.all(rows.map(async (row) => {
    const { data: items, error: itemsError } = await supabase.from('place_collection_items').select(`display_order,places(${PLACE_COLUMNS})`).eq('collection_id', row.id).order('display_order', { ascending: true }).limit(100);
    if (itemsError) throw new Error(itemsError.message);
    return mapPlaceCollection(row, (items ?? []) as unknown as PlaceCollectionItemRow[]);
  }));
}
