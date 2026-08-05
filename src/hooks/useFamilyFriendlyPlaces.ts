import { useCallback, useEffect, useRef, useState } from 'react';
import type { FamilyFriendlyPlace, PlaceFilters, PlaceViewport } from '@/types/familyFriendlyPlace';
import { queryFamilyFriendlyPlaces } from '@/lib/familyFriendlyPlaces';

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
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    if (!options.enabled) return;
    if (options.mockPlaces) {
      setPlaces(options.mockPlaces);
      setError(null);
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
        limit: 80,
      });
      if (id === requestId.current) setPlaces(result);
    } catch {
      if (id === requestId.current) setError("Couldn't load places. Please try again.");
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
  }, [options.enabled, options.filters, options.mockPlaces, options.userCoordinate, options.viewport]);

  useEffect(() => {
    const timer = setTimeout(refresh, 250);
    return () => clearTimeout(timer);
  }, [refresh]);

  return { places, isLoading, error, refresh };
}
