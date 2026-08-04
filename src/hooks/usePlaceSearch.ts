import { useEffect, useRef, useState } from 'react';
import { invokePlaceSearch } from '@/lib/placeSearchClient';
import type { NormalizedPlace } from '@/types/place';
import {
  PlaceSearchCoordinator,
  type PlaceSearchItem,
  type PlaceSearchState,
} from '@/utils/placeSearchCoordinator';

export type { PlaceSearchItem, PlaceSearchStatus } from '@/utils/placeSearchCoordinator';

interface UsePlaceSearchResult extends PlaceSearchState {
  setQuery: (query: string) => void;
  clear: () => void;
  clearResults: () => void;
  retry: () => void;
  resolveResult: (result: PlaceSearchItem) => Promise<NormalizedPlace>;
}

/** Provider-neutral place search. The client invokes only the authenticated
 * Supabase function; Apple endpoints and credentials never enter the bundle. */
export function usePlaceSearch(regionCenter: { latitude: number; longitude: number }): UsePlaceSearchResult {
  const centerRef = useRef(regionCenter);
  centerRef.current = regionCenter;
  const coordinatorRef = useRef<PlaceSearchCoordinator | null>(null);
  if (!coordinatorRef.current) coordinatorRef.current = new PlaceSearchCoordinator(invokePlaceSearch);
  const coordinator = coordinatorRef.current;
  const [state, setState] = useState<PlaceSearchState>({ query: '', results: [], status: 'idle', errorMessage: null });

  useEffect(() => coordinator.subscribe(setState), [coordinator]);
  useEffect(() => () => coordinator.dispose(), [coordinator]);

  return {
    ...state,
    setQuery: (query) => coordinator.setQuery(query, centerRef.current),
    clear: () => coordinator.clear(),
    clearResults: () => coordinator.clearResults(),
    retry: () => coordinator.retry(),
    resolveResult: (result) => coordinator.resolve(result),
  };
}

