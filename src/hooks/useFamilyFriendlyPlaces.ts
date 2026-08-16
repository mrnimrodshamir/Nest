import { useCallback, useEffect, useRef, useState } from 'react';
import type { FamilyFriendlyPlace, PlaceFilters, PlaceViewport } from '@/types/familyFriendlyPlace';
import { queryFamilyFriendlyPlaces } from '@/lib/familyFriendlyPlaces';
import { placeMatchesFilters } from '@/utils/familyFriendlyPlace';
import { currentAppLocale, translate } from '@/i18n';

const PAGE_SIZE = 80;

interface Options {
  enabled: boolean;
  viewport: PlaceViewport;
  filters?: PlaceFilters;
  userCoordinate?: { latitude: number; longitude: number } | null;
  mockPlaces?: FamilyFriendlyPlace[];
}

export function useFamilyFriendlyPlaces(options: Options) {
  const [places, setPlaces] = useState<FamilyFriendlyPlace[]>(options.mockPlaces ?? []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const requestId = useRef(0);
  const pageRef = useRef(0);

  const refresh = useCallback(async () => {
    if (!options.enabled) return;
    if (options.mockPlaces) {
      setPlaces(options.mockPlaces.filter((place) => placeMatchesFilters({ ...place, verificationStatus: 'verified' }, options.filters ?? {})));
      setError(null);
      setHasMore(false);
      return;
    }
    const id = ++requestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await queryFamilyFriendlyPlaces({
        viewport: options.viewport,
        filters: options.filters,
        userCoordinate: options.userCoordinate,
        limit: PAGE_SIZE, page: 0,
      });
      if (id === requestId.current) { pageRef.current = 0; setPlaces(result); setHasMore(result.length === PAGE_SIZE); }
    } catch {
      if (id === requestId.current) setError(translate(currentAppLocale(), 'error.placesLoad'));
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
  }, [options.enabled, options.filters, options.mockPlaces, options.userCoordinate, options.viewport]);

  useEffect(() => {
    const timer = setTimeout(refresh, 250);
    return () => clearTimeout(timer);
  }, [refresh]);

  const loadMore = useCallback(async () => {
    if (!options.enabled || options.mockPlaces || isLoading || !hasMore) return;
    const id = ++requestId.current; const nextPage = pageRef.current + 1; setIsLoading(true);
    try {
      const result = await queryFamilyFriendlyPlaces({ viewport: options.viewport, filters: options.filters, userCoordinate: options.userCoordinate, limit: PAGE_SIZE, page: nextPage });
      if (id === requestId.current) {
        pageRef.current = nextPage;
        setPlaces((current) => [...new Map([...current, ...result].map((place) => [place.id, place])).values()]);
        setHasMore(result.length === PAGE_SIZE);
      }
    } catch { if (id === requestId.current) setError(translate(currentAppLocale(), 'error.placesMoreLoad')); }
    finally { if (id === requestId.current) setIsLoading(false); }
  }, [hasMore, isLoading, options.enabled, options.filters, options.mockPlaces, options.userCoordinate, options.viewport]);

  return { places, isLoading, error, hasMore, refresh, loadMore };
}
