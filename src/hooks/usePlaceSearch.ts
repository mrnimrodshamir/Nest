import { useCallback, useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { normalizePlaceResult, type PlaceResult } from '@/utils/normalizePlaceResult';
import { createRequestGuard } from '@/utils/staleRequestGuard';

export type { PlaceResult } from '@/utils/normalizePlaceResult';

type SearchStatus = 'idle' | 'loading' | 'results' | 'empty' | 'error' | 'unavailable';

interface UsePlaceSearchResult {
  query: string;
  setQuery: (query: string) => void;
  results: PlaceResult[];
  status: SearchStatus;
  errorMessage: string | null;
  clear: () => void;
}

const DEBOUNCE_MS = 350;
const MIN_QUERY_LENGTH = 2;
const MAX_RESULTS = 5;

/** Debounced POI search backed by expo-location's on-device geocoder
 *  (Apple's CLGeocoder under the hood on iOS) — free, no API key, no new
 *  native module, no new EAS build; the same underlying capability
 *  already used for reverse-geocoding on map drag.
 *
 *  Known limitation, documented rather than hidden: unlike MKLocalSearch
 *  or Google Places, CLGeocoder via expo-location has no region-bias
 *  parameter, so results aren't weighted toward `regionCenter` — it's
 *  accepted here only so the hook's contract can add real biasing later
 *  without a call-site change. It's also address/landmark-oriented rather
 *  than a full POI index, so small local businesses (a specific café) are
 *  less reliably found than a well-known place name.
 *
 *  A provider-neutral Apple Maps Server API Edge Function contract is
 *  prepared locally, but intentionally remains disconnected until the
 *  Stage 2 search UI integration. */
export function usePlaceSearch(regionCenter: { latitude: number; longitude: number }): UsePlaceSearchResult {
  const [query, setQueryState] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against a slow/stale response landing after a newer query has
  // already been typed — only the most recent request may write results.
  // See staleRequestGuard.ts for the (unit-tested) guarding logic itself.
  const guard = useRef(createRequestGuard());
  // Accepted for a future region-biasing capability — see doc comment.
  const regionRef = useRef(regionCenter);
  regionRef.current = regionCenter;

  const runSearch = useCallback(async (text: string) => {
    const token = guard.current.next();
    setStatus('loading');
    setErrorMessage(null);
    try {
      const geocoded = await Location.geocodeAsync(text);
      if (!guard.current.isCurrent(token)) return;

      if (geocoded.length === 0) {
        setResults([]);
        setStatus('empty');
        return;
      }

      const normalized = await Promise.all(
        geocoded.slice(0, MAX_RESULTS).map((point, index) => normalizePlaceResult(point, text, index)),
      );
      if (!guard.current.isCurrent(token)) return;

      setResults(normalized);
      setStatus('results');
    } catch {
      if (!guard.current.isCurrent(token)) return;
      setStatus('error');
      setErrorMessage('Search failed — drag the map instead.');
      setResults([]);
    }
  }, []);

  const setQuery = useCallback(
    (text: string) => {
      setQueryState(text);
      if (debounceTimer.current) clearTimeout(debounceTimer.current);

      const trimmed = text.trim();
      if (trimmed.length < MIN_QUERY_LENGTH) {
        guard.current.invalidate();
        setResults([]);
        setStatus('idle');
        setErrorMessage(null);
        return;
      }

      debounceTimer.current = setTimeout(() => void runSearch(trimmed), DEBOUNCE_MS);
    },
    [runSearch],
  );

  const clear = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    guard.current.invalidate();
    setQueryState('');
    setResults([]);
    setStatus('idle');
    setErrorMessage(null);
  }, []);

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

  return { query, setQuery, results, status, errorMessage, clear };
}
