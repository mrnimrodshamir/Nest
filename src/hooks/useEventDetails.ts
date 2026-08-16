import { useCallback, useEffect, useRef, useState } from 'react';
import { getEventDetails, localizeEvents } from '@/lib/events';
import type { EventDetails } from '@/types/event';
import { useI18n } from '@/i18n';

export function useEventDetails(occurrenceId: string) {
  const { locale } = useI18n();
  const [event, setEvent] = useState<EventDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);
  const refresh = useCallback(async () => {
    const id = ++requestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const original = await getEventDetails(occurrenceId);
      if (id !== requestId.current) return;
      setEvent(original);
      void localizeEvents([original], locale).then(([localized]) => {
        if (id === requestId.current) setEvent(localized);
      });
    }
    catch { if (id === requestId.current) setError("Couldn't load this event."); }
    finally { if (id === requestId.current) setIsLoading(false); }
  }, [locale, occurrenceId]);
  useEffect(() => { refresh(); return () => { requestId.current += 1; }; }, [refresh]);
  return { event, isLoading, error, refresh };
}
