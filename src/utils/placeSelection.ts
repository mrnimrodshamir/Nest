import type { NormalizedPlace, SelectedActivityLocation } from '@/types/place';
import { normalizedPlaceToSelectedLocation } from '@/utils/activityPlaceMapping';

export const LOCATION_PICKER_DELTA = 0.02;

export function selectProviderPlace(place: NormalizedPlace): {
  selection: SelectedActivityLocation;
  cameraRegion: { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
} {
  return {
    selection: normalizedPlaceToSelectedLocation({ ...place, source: 'provider', wasAdjusted: false }),
    cameraRegion: {
      latitude: place.latitude,
      longitude: place.longitude,
      latitudeDelta: LOCATION_PICKER_DELTA,
      longitudeDelta: LOCATION_PICKER_DELTA,
    },
  };
}

