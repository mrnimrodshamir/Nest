import type { FeaturedPlaceSection } from '@/types/placeCollection';

export interface FeaturedPlaceCandidate {
  id: string;
  name: string;
  isFeatured: boolean;
  featuredOrder: number | null;
  featuredUntil: string | null;
  createdAt: string;
  popularityScore: number;
}

export function rankFeaturedCandidates(candidates: FeaturedPlaceCandidate[], section: FeaturedPlaceSection, now = new Date()): FeaturedPlaceCandidate[] {
  const copy = [...candidates];
  if (section === 'featured_this_week' || section === 'editors_picks') {
    return copy.filter((item) => item.isFeatured && (item.featuredUntil == null || new Date(item.featuredUntil) > now))
      .sort((a, b) => (a.featuredOrder ?? Infinity) - (b.featuredOrder ?? Infinity) || a.name.localeCompare(b.name));
  }
  if (section === 'new_places') return copy.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime() || a.name.localeCompare(b.name));
  return copy.sort((a, b) => b.popularityScore - a.popularityScore || a.name.localeCompare(b.name));
}
