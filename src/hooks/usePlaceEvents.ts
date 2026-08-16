import { useCallback, useEffect, useRef, useState } from 'react';
import { localizeEvents, queryEventsAtPlace } from '@/lib/events';
import type { EventDetails } from '@/types/event';
import { translate, useI18n } from '@/i18n';

export function usePlaceEvents(placeId: string) {
  const { locale } = useI18n();
  const [events, setEvents] = useState<EventDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const original = await queryEventsAtPlace(placeId);
      if (id !== requestId.current) return;
      setEvents(original);
      void localizeEvents(original, locale).then((localized) => {
        if (id === requestId.current) setEvents(localized);
      });
    }
    catch { if (id === requestId.current) setError(translate(locale, 'error.eventsHereLoad')); }
    finally { if (id === requestId.current) setIsLoading(false); }
  }, [locale, placeId]);
  useEffect(() => { refresh(); return () => { requestId.current += 1; }; }, [refresh]);
  return { events, isLoading, error, refresh };
}
