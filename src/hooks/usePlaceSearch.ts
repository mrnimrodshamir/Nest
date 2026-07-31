import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';

export interface PlaceResult {
  id: string;
  name: string;
  formattedAddress: string;
  latitude: number;
  longitude: number;
}

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

/** Debounced POI search backed by the search-places Edge Function (Google
 *  Places Text Search, proxied so the API key never reaches the client).
 *  `regionCenter` biases results toward wherever the picker's map
 *  currently is — not a hard restriction, just relevance ranking. */
export function usePlaceSearch(regionCenter: { latitude: number; longitude: number }): UsePlaceSearchResult {
  const [query, setQueryState] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [status, setStatus] = useState<SearchStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Guards against a slow/stale response landing after a newer query has
  // already been typed — only the most recent request may write results.
  const requestId = useRef(0);
  const regionRef = useRef(regionCenter);
  regionRef.current = regionCenter;

  const runSearch = useCallback(async (text: string) => {
    const thisRequest = ++requestId.current;
    setStatus('loading');
    setErrorMessage(null);
    try {
      const { data, error } = await supabase.functions.invoke<{ results?: PlaceResult[]; error?: string }>(
        'search-places',
        {
          method: 'POST',
          body: { query: text, latitude: regionRef.current.latitude, longitude: regionRef.current.longitude },
        },
      );
      if (thisRequest !== requestId.current) return;

      if (error || data?.error) {
        const code = data?.error;
        if (code === 'search_unavailable') {
          setStatus('unavailable');
          setErrorMessage("Search isn't set up yet — drag the map to choose a spot.");
        } else if (code === 'rate_limited') {
          setStatus('error');
          setErrorMessage('Too many searches — wait a moment and try again.');
        } else {
          setStatus('error');
          setErrorMessage('Search failed — drag the map instead.');
        }
        setResults([]);
        return;
      }

      const found = data?.results ?? [];
      setResults(found);
      setStatus(found.length === 0 ? 'empty' : 'results');
    } catch {
      if (thisRequest !== requestId.current) return;
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
        requestId.current += 1; // invalidate any in-flight request
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
    requestId.current += 1;
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
