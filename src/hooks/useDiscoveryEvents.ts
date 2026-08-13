import { useCallback, useEffect, useRef, useState } from 'react';
import { queryDiscoveryEvents, queryEventAttendanceCounts } from '@/lib/events';
import type { EventDetails } from '@/types/event';
import type { PlaceViewport } from '@/types/familyFriendlyPlace';

export function useDiscoveryEvents(options: { viewport: PlaceViewport; mockEvents?: EventDetails[] }) {
  const [events, setEvents] = useState<EventDetails[]>(options.mockEvents ?? []);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [attendeeCounts, setAttendeeCounts] = useState<Record<string, number>>({});
  const requestId = useRef(0);

  const refresh = useCallback(async () => {
    if (options.mockEvents) {
      setEvents(options.mockEvents);
      setAttendeeCounts({});
      setError(null);
      return;
    }
    const id = ++requestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const result = await queryDiscoveryEvents(options.viewport);
      if (id === requestId.current) {
        setEvents(result);
        setAttendeeCounts({});
      }
      // Attendance is a secondary social signal. A transient count-query
      // failure must never hide otherwise valid Events from Discovery.
      try {
        const counts = await queryEventAttendanceCounts(result.map((event) => event.occurrence.id));
        if (id === requestId.current) setAttendeeCounts(counts);
      } catch {
        if (id === requestId.current) setAttendeeCounts({});
      }
    } catch {
      if (id === requestId.current) setError("Events couldn't refresh.");
    } finally {
      if (id === requestId.current) setIsLoading(false);
    }
  }, [options.mockEvents, options.viewport]);

  useEffect(() => {
    const timer = setTimeout(refresh, 250);
    return () => { clearTimeout(timer); requestId.current += 1; };
  }, [refresh]);

  return { events, attendeeCounts, isLoading, error, refresh };
}
