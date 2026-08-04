import type { NormalizedPlace, SelectedActivityLocation } from '@/types/place';
import { createLegacyPlace, createManualPlace } from '@/utils/normalizedPlace';

export interface ActivityPlaceColumns {
  place_name?: string | null;
  formatted_address?: string | null;
  place_category?: string | null;
  place_provider?: 'apple_maps' | null;
  provider_place_id?: string | null;
  location_source?: 'provider' | 'manual' | 'legacy' | null;
  location_was_adjusted?: boolean | null;
}

export interface LegacyActivityLocationColumns extends ActivityPlaceColumns {
  address_label: string;
  latitude: number;
  longitude: number;
}

export function normalizedPlaceToColumns(place: NormalizedPlace) {
  return {
    place_name: place.name,
    formatted_address: place.formattedAddress,
    place_category: place.category,
    place_provider: place.provider,
    provider_place_id: place.providerPlaceId,
    location_source: place.source,
    location_was_adjusted: place.wasAdjusted,
  };
}

export function activityColumnsToNormalizedPlace(row: LegacyActivityLocationColumns): NormalizedPlace {
  if (!row.location_source) {
    return createLegacyPlace({ addressLabel: row.address_label, latitude: row.latitude, longitude: row.longitude });
  }

  return {
    name: row.place_name?.trim() || row.address_label.trim() || 'Selected meeting point',
    formattedAddress: row.formatted_address?.trim() || null,
    latitude: row.latitude,
    longitude: row.longitude,
    category: row.place_category?.trim() || null,
    provider: row.place_provider === 'apple_maps' ? 'apple_maps' : null,
    providerPlaceId: row.provider_place_id?.trim() || null,
    source: row.location_source,
    wasAdjusted: row.location_was_adjusted === true,
  };
}

export function normalizedPlaceToSelectedLocation(place: NormalizedPlace): SelectedActivityLocation {
  return {
    place: place.source === 'provider' ? place : null,
    latitude: place.latitude,
    longitude: place.longitude,
    displayName: place.name,
    addressLabel: place.formattedAddress,
    source: place.source,
    wasAdjusted: place.wasAdjusted,
  };
}

export function legacyFieldsToSelectedLocation(input: {
  addressLabel: string;
  latitude: number;
  longitude: number;
}): SelectedActivityLocation {
  const legacy = createLegacyPlace(input);
  return normalizedPlaceToSelectedLocation(legacy);
}

export function activityColumnsToSelectedLocation(row: LegacyActivityLocationColumns): SelectedActivityLocation {
  return normalizedPlaceToSelectedLocation(activityColumnsToNormalizedPlace(row));
}

export function selectedLocationToNormalizedPlace(selection: SelectedActivityLocation): NormalizedPlace {
  if (selection.source === 'provider' && selection.place) {
    return {
      ...selection.place,
      name: selection.displayName.trim() || selection.place.name,
      formattedAddress: selection.addressLabel?.trim() || null,
      latitude: selection.latitude,
      longitude: selection.longitude,
      source: 'provider',
      wasAdjusted: false,
    };
  }
  if (selection.source === 'legacy') {
    return createLegacyPlace({
      addressLabel: selection.displayName || selection.addressLabel || 'Selected meeting point',
      latitude: selection.latitude,
      longitude: selection.longitude,
    });
  }
  return {
    ...createManualPlace({
      name: selection.displayName,
      formattedAddress: selection.addressLabel,
      latitude: selection.latitude,
      longitude: selection.longitude,
    }),
    wasAdjusted: selection.wasAdjusted,
  };
}
