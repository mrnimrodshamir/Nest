import { supabase } from '@/lib/supabase';
import type { FamilyFriendlyPlace, FamilyFriendlyPlaceRow, PlaceQueryInput } from '@/types/familyFriendlyPlace';
import { mapFamilyFriendlyPlaceRow } from '@/utils/familyFriendlyPlace';
import { distanceMeters, validatePlaceQueryInput } from '@/utils/placeViewport';
import { normalizePlaceSearchQuery } from '@/utils/placeSearch';

export const PLACE_COLUMNS = 'id,name,slug,category,short_description,full_description,latitude,longitude,formatted_address,neighborhood,city,country_code,provider,provider_place_id,website_url,phone,cover_image_url,gallery_image_urls,is_indoor,is_outdoor,is_free,price_note,min_age_months,max_age_months,stroller_friendly,changing_table,high_chairs,toilets,shade,water_fountain,accessible,parking_note,opening_hours,source_name,source_url,verification_status,last_verified_at,is_active';

export async function queryFamilyFriendlyPlaces(input: PlaceQueryInput): Promise<FamilyFriendlyPlace[]> {
  const { viewport, limit } = validatePlaceQueryInput(input);
  const page = Math.max(0, Math.floor(input.page ?? 0));
  if (input.filters?.openNow) throw new Error('Open Now requires normalized opening hours and is not available yet');
  if (input.filters?.maxDistanceMeters != null && !input.userCoordinate) throw new Error('Distance filtering requires a user coordinate');
  let query = supabase
    .from('places')
    .select(PLACE_COLUMNS)
    .eq('is_active', true)
    .eq('verification_status', 'verified')
    .gte('latitude', viewport.south)
    .lte('latitude', viewport.north)
    .gte('longitude', viewport.west)
    .lte('longitude', viewport.east)
    .order('name', { ascending: true })
    .order('id', { ascending: true })
    .range(page * limit, page * limit + limit - 1);

  const filters = input.filters;
  if (filters?.category) query = query.eq('category', filters.category);
  if (filters?.environment === 'indoor') query = query.eq('is_indoor', true);
  if (filters?.environment === 'outdoor') query = query.eq('is_outdoor', true);
  if (filters?.cost === 'free') query = query.eq('is_free', true);
  if (filters?.cost === 'paid') query = query.eq('is_free', false);
  if (filters?.changingTable) query = query.eq('changing_table', true);
  if (filters?.toilets) query = query.eq('toilets', true);
  if (filters?.highChairs) query = query.eq('high_chairs', true);
  if (filters?.shade) query = query.eq('shade', true);
  if (filters?.waterFountain) query = query.eq('water_fountain', true);
  if (filters?.accessible) query = query.eq('accessible', true);
  if (filters?.ageMonths != null) {
    query = query
      .or(`min_age_months.is.null,min_age_months.lte.${filters.ageMonths}`)
      .or(`max_age_months.is.null,max_age_months.gte.${filters.ageMonths}`);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const places = ((data ?? []) as unknown as FamilyFriendlyPlaceRow[]).map(mapFamilyFriendlyPlaceRow);
  if (!input.userCoordinate) return places;
  const withDistance = places
    .map((place) => ({ ...place, distanceMeters: distanceMeters(input.userCoordinate!, place) }))
    .sort((a, b) => (a.distanceMeters ?? Infinity) - (b.distanceMeters ?? Infinity) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  return filters?.maxDistanceMeters != null
    ? withDistance.filter((place) => (place.distanceMeters ?? Infinity) <= filters.maxDistanceMeters!)
    : withDistance;
}

export async function getFamilyFriendlyPlace(id: string): Promise<FamilyFriendlyPlace> {
  const { data, error } = await supabase
    .from('places')
    .select(PLACE_COLUMNS)
    .eq('id', id)
    .eq('is_active', true)
    .eq('verification_status', 'verified')
    .single();
  if (error) throw new Error(error.message);
  return mapFamilyFriendlyPlaceRow(data as unknown as FamilyFriendlyPlaceRow);
}

export async function searchFamilyFriendlyPlaces(searchQuery: string, limit = 40): Promise<FamilyFriendlyPlace[]> {
  const query = normalizePlaceSearchQuery(searchQuery);
  if (!query) return [];
  const { data, error } = await supabase.rpc('search_curated_places', {
    search_query: query,
    result_limit: Math.max(1, Math.min(limit, 100)),
  });
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as FamilyFriendlyPlaceRow[]).map(mapFamilyFriendlyPlaceRow);
}

export async function queryFeaturedFamilyFriendlyPlaces(kind: 'featured' | 'new' | 'popular', limit = 20): Promise<FamilyFriendlyPlace[]> {
  let query = supabase.from('places').select(PLACE_COLUMNS).eq('is_active', true).eq('is_hidden', false).eq('verification_status', 'verified');
  if (kind === 'featured') query = query.eq('is_featured', true).or(`featured_until.is.null,featured_until.gt.${new Date().toISOString()}`).order('featured_order', { ascending: true, nullsFirst: false });
  if (kind === 'new') query = query.order('created_at', { ascending: false });
  if (kind === 'popular') query = query.order('popularity_score', { ascending: false });
  const { data, error } = await query.order('name', { ascending: true }).limit(Math.max(1, Math.min(limit, 50)));
  if (error) throw new Error(error.message);
  return ((data ?? []) as unknown as FamilyFriendlyPlaceRow[]).map(mapFamilyFriendlyPlaceRow);
}
