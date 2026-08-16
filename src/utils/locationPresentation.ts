import type { SelectedActivityLocation } from '@/types/place';
import { currentAppLocale, translate } from '@/i18n/core';

export interface LocationPresentation {
  title: string;
  address: string | null;
  isManuallyAdjusted: boolean;
}

export function presentLocationName(value: string): string {
  const trimmed = value.trim();
  return !trimmed || trimmed.toLocaleLowerCase() === 'meeting point'
    ? translate(currentAppLocale(), 'locationPicker.meetingPoint')
    : trimmed;
}

export function presentSelectedLocation(selection: SelectedActivityLocation): LocationPresentation {
  const fallback = translate(currentAppLocale(), 'locationPicker.meetingPoint');
  const rawTitle = selection.displayName.trim();
  const isGenericTitle = !rawTitle || rawTitle.toLocaleLowerCase() === 'meeting point';
  const title = selection.source === 'manual' && selection.wasAdjusted || isGenericTitle ? fallback : rawTitle;
  const rawAddress = selection.addressLabel?.trim() || null;
  const address = rawAddress?.toLocaleLowerCase() === 'meeting point' ? null : rawAddress;
  return {
    title,
    address: address && address !== title ? address : null,
    isManuallyAdjusted: selection.source === 'manual' && selection.wasAdjusted,
  };
}
