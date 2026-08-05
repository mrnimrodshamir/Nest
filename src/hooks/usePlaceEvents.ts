import { useCallback, useEffect, useState } from 'react';
import { queryEventsAtPlace } from '@/lib/events';
import type { EventDetails } from '@/types/event';

export function usePlaceEvents(placeId: string) {
  const [events, setEvents] = useState<EventDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try { setEvents(await queryEventsAtPlace(placeId)); }
    catch { setError("Couldn't load events here."); }
    finally { setIsLoading(false); }
  }, [placeId]);
  useEffect(() => { refresh(); }, [refresh]);
  return { events, isLoading, error, refresh };
}
