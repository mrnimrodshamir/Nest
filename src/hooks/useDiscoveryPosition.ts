import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { FALLBACK_LOCATION } from '@/constants/location';
import type { DiscoveryCoordinate } from '@/types/discovery';

interface DiscoveryPositionState {
  userCoordinate: DiscoveryCoordinate | null;
  mapOrigin: DiscoveryCoordinate;
  locationDenied: boolean;
  isResolving: boolean;
}

/** One permission/current-position request shared by every Discovery query. */
export function useDiscoveryPosition(enabled = true): DiscoveryPositionState {
  const [state, setState] = useState<DiscoveryPositionState>({
    userCoordinate: null,
    mapOrigin: FALLBACK_LOCATION,
    locationDenied: false,
    isResolving: enabled,
  });

  useEffect(() => {
    if (!enabled) {
      setState({ userCoordinate: null, mapOrigin: FALLBACK_LOCATION, locationDenied: false, isResolving: false });
      return;
    }
    let active = true;
    void (async () => {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (!active) return;
        if (permission.status !== 'granted') {
          setState({ userCoordinate: null, mapOrigin: FALLBACK_LOCATION, locationDenied: true, isResolving: false });
          return;
        }
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        if (!active) return;
        const coordinate = { latitude: position.coords.latitude, longitude: position.coords.longitude };
        setState({ userCoordinate: coordinate, mapOrigin: coordinate, locationDenied: false, isResolving: false });
      } catch {
        if (active) setState({ userCoordinate: null, mapOrigin: FALLBACK_LOCATION, locationDenied: false, isResolving: false });
      }
    })();
    return () => { active = false; };
  }, [enabled]);

  return state;
}
