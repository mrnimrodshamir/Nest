import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

export function useNetworkStatus(): { isOffline: boolean } {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      // isInternetReachable can be null while still determining — only
      // treat it as offline once we're confident, to avoid a flash.
      setIsOffline(state.isConnected === false || state.isInternetReachable === false);
    });
    return unsubscribe;
  }, []);

  return { isOffline };
}
