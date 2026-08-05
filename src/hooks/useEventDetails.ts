import { useCallback, useEffect, useState } from 'react';
import { getEventDetails } from '@/lib/events';
import type { EventDetails } from '@/types/event';

export function useEventDetails(occurrenceId: string) {
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const refresh = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try { setEvent(await getEventDetails(occurrenceId)); }
    catch { setError("Couldn't load this event."); }
    finally { setIsLoading(false); }
  }, [occurrenceId]);
  useEffect(() => { refresh(); }, [refresh]);
  return { event, isLoading, error, refresh };
}
