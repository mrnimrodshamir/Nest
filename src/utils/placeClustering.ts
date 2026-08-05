import type { FamilyFriendlyPlace } from '@/types/familyFriendlyPlace';

export type PlaceMapItem =
  | { kind: 'place'; place: FamilyFriendlyPlace }
  | { kind: 'cluster'; id: string; latitude: number; longitude: number; places: FamilyFriendlyPlace[] };

export function clusterPlacesForRegion(
  places: FamilyFriendlyPlace[],
  region: { latitudeDelta: number; longitudeDelta: number },
  markerBudget = 45,
): PlaceMapItem[] {
  if (places.length <= markerBudget) return places.map((place) => ({ kind: 'place', place }));
  const latSize = Math.max(region.latitudeDelta / 9, 0.0005);
  const lngSize = Math.max(region.longitudeDelta / 9, 0.0005);
  const buckets = new Map<string, FamilyFriendlyPlace[]>();
  for (const place of places) {
    const key = `${Math.floor(place.latitude / latSize)}:${Math.floor(place.longitude / lngSize)}`;
    buckets.set(key, [...(buckets.get(key) ?? []), place]);
  }
  return [...buckets.entries()].map(([key, members]) => {
    if (members.length === 1) return { kind: 'place' as const, place: members[0] };
    return {
      kind: 'cluster' as const, id: `cluster:${key}`,
      latitude: members.reduce((sum, place) => sum + place.latitude, 0) / members.length,
      longitude: members.reduce((sum, place) => sum + place.longitude, 0) / members.length,
      places: members,
    };
  });
}
