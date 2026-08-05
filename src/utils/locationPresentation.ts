import type { SelectedActivityLocation } from '@/types/place';

export interface LocationPresentation {
  title: string;
  address: string | null;
  isManuallyAdjusted: boolean;
}

export function presentSelectedLocation(selection: SelectedActivityLocation): LocationPresentation {
  const title = selection.source === 'manual' && selection.wasAdjusted
    ? 'Meeting point'
    : selection.displayName.trim() || 'Meeting point';
  const address = selection.addressLabel?.trim() || null;
  return {
    title,
    address: address && address !== title ? address : null,
    isManuallyAdjusted: selection.source === 'manual' && selection.wasAdjusted,
  };
}
