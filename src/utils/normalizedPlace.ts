import type { NormalizedPlace } from '@/types/place';

export interface ProviderPlaceInput {
  name: string;
  formattedAddress?: string | null;
  latitude: number;
  longitude: number;
  category?: string | null;
  providerPlaceId?: string | null;
}

export interface ManualPlaceInput {
  name?: string | null;
  formattedAddress?: string | null;
  latitude: number;
  longitude: number;
}

export interface LegacyPlaceInput {
  addressLabel: string;
  latitude: number;
  longitude: number;
}

export function isValidCoordinate(latitude: number, longitude: number): boolean {
  return (
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function assertCoordinates(latitude: number, longitude: number): void {
  if (!isValidCoordinate(latitude, longitude)) {
    throw new RangeError('Invalid place coordinates');
  }
}

function optionalText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function requiredName(value: string, fallback: string): string {
  return optionalText(value) ?? fallback;
}

export function createAppleMapsPlace(input: ProviderPlaceInput): NormalizedPlace {
  assertCoordinates(input.latitude, input.longitude);
  return {
    name: requiredName(input.name, 'Selected place'),
    formattedAddress: optionalText(input.formattedAddress),
    latitude: input.latitude,
    longitude: input.longitude,
    category: optionalText(input.category),
    provider: 'apple_maps',
    providerPlaceId: optionalText(input.providerPlaceId),
    source: 'provider',
    wasAdjusted: false,
  };
}

export function createManualPlace(input: ManualPlaceInput): NormalizedPlace {
  assertCoordinates(input.latitude, input.longitude);
  return {
    name: requiredName(input.name ?? '', 'Selected meeting point'),
    formattedAddress: optionalText(input.formattedAddress),
    latitude: input.latitude,
    longitude: input.longitude,
    category: null,
    provider: null,
    providerPlaceId: null,
    source: 'manual',
    wasAdjusted: false,
  };
}

export function createLegacyPlace(input: LegacyPlaceInput): NormalizedPlace {
  assertCoordinates(input.latitude, input.longitude);
  return {
    name: requiredName(input.addressLabel, 'Selected meeting point'),
    formattedAddress: optionalText(input.addressLabel),
    latitude: input.latitude,
    longitude: input.longitude,
    category: null,
    provider: null,
    providerPlaceId: null,
    source: 'legacy',
    wasAdjusted: false,
  };
}

