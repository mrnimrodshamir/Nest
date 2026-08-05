export interface PlaceQualityInput {
  coverImageUrl?: string | null;
  shortDescription?: string | null;
  fullDescription?: string | null;
  openingHours?: Record<string, unknown> | null;
  websiteUrl?: string | null;
  accessible?: boolean | null;
  strollerFriendly?: boolean | null;
  changingTable?: boolean | null;
  highChairs?: boolean | null;
  toilets?: boolean | null;
  shade?: boolean | null;
  waterFountain?: boolean | null;
}

export type PlaceQualityGap = 'image' | 'description' | 'hours' | 'website' | 'accessibility' | 'family_metadata';

const PENALTIES: Record<PlaceQualityGap, number> = { image: 20, description: 15, hours: 15, website: 10, accessibility: 10, family_metadata: 30 };

export function calculatePlaceQuality(input: PlaceQualityInput): { score: number; gaps: PlaceQualityGap[] } {
  const gaps: PlaceQualityGap[] = [];
  if (!input.coverImageUrl?.trim()) gaps.push('image');
  if (!input.shortDescription?.trim() && !input.fullDescription?.trim()) gaps.push('description');
  if (!input.openingHours || Object.keys(input.openingHours).length === 0) gaps.push('hours');
  if (!input.websiteUrl?.trim()) gaps.push('website');
  if (input.accessible == null) gaps.push('accessibility');
  if ([input.strollerFriendly,input.changingTable,input.highChairs,input.toilets,input.shade,input.waterFountain].every((value) => value == null)) gaps.push('family_metadata');
  return { score: Math.max(0, 100 - gaps.reduce((total, gap) => total + PENALTIES[gap], 0)), gaps };
}
