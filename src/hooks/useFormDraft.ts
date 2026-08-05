import { useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DRAFT_PREFIX = 'nestup.draft.';
const DEBOUNCE_MS = 400;

/**
 * Persists a plain object of form field values to AsyncStorage so a closed
 * app or a dropped network connection during submit doesn't lose what was
 * typed. Returns the draft loaded on mount (or null if there wasn't one)
 * so the caller can seed its own useState with it, plus save/clear.
 */
export function useFormDraft<T extends object>(key: string) {
  const [initialDraft, setInitialDraft] = useState<T | null | undefined>(undefined); // undefined = still loading
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(DRAFT_PREFIX + key).then((raw) => {
      if (!raw) return setInitialDraft(null);
      try {
        setInitialDraft(JSON.parse(raw) as T);
      } catch {
        setInitialDraft(null);
      }
    });
  }, [key]);

  const save = (values: T) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      AsyncStorage.setItem(DRAFT_PREFIX + key, JSON.stringify(values));
    }, DEBOUNCE_MS);
  };

  const clear = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    AsyncStorage.removeItem(DRAFT_PREFIX + key);
  };

  return { initialDraft, save, clear };
}
