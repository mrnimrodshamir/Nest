import { useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'momzi.photoNudgeShown';

/** Exactly once, ever, per device -- after that, never ask again regardless
 *  of whether they added a photo or skipped. */
export function usePhotoNudge() {
  const shouldShow = useCallback(async (hasPhoto: boolean) => {
    if (hasPhoto) return false;
    try {
      const shown = await AsyncStorage.getItem(STORAGE_KEY);
      return shown !== 'true';
    } catch {
      return false;
    }
  }, []);

  const markShown = useCallback(async () => {
    try {
      await AsyncStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // Non-fatal — worst case the nudge shows again once more.
    }
  }, []);

  return { shouldShow, markShown };
}
