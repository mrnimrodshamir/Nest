import type { FamilyFriendlyPlace, PlaceCategory } from '@/types/familyFriendlyPlace';

const categories: PlaceCategory[] = ['playground','park','indoor_playground','family_cafe','museum','library','beach','pool','zoo_or_animals','picnic_area','community_center','attraction'];
const names = ['Little Lantern Playground','Green Kite Park','Cloud Room Indoor Play','Tiny Table Family Café','Curious Cub Museum','Story Nest Library','Sunny Shell Beach','Blue Sprout Pool','Kind Creatures Corner','Picnic Patch','Family Hub Center','Wonder Walk'];

export const MOCK_FAMILY_FRIENDLY_PLACES: FamilyFriendlyPlace[] = categories.map((category, index) => ({
  id: `dev-place-${index + 1}`, name: names[index], slug: `dev-${category}-${index + 1}`, category,
  shortDescription: 'Fictional development fixture for UI testing only.', fullDescription: null,
  latitude: 32.075 + index * 0.002, longitude: 34.775 + (index % 4) * 0.003,
  formattedAddress: `${10 + index} Fixture Street, Tel Aviv-Yafo`, neighborhood: 'Development District',
  city: 'Tel Aviv-Yafo', countryCode: 'IL', provider: null, providerPlaceId: null,
  websiteUrl: null, phone: null, coverImageUrl: null, galleryImageUrls: null,
  isIndoor: ['indoor_playground','family_cafe','museum','library','pool','community_center'].includes(category),
  isOutdoor: ['playground','park','beach','zoo_or_animals','picnic_area','attraction'].includes(category),
  isFree: index % 2 === 0, priceNote: null, minAgeMonths: 0, maxAgeMonths: 120,
  strollerFriendly: true, changingTable: index % 3 === 0, highChairs: category === 'family_cafe',
  toilets: true, shade: true, waterFountain: index % 2 === 0, accessible: true, parkingNote: null,
  openingHours: null, sourceName: 'Development fixture', sourceUrl: null,
  verificationStatus: 'draft', lastVerifiedAt: null, isActive: true, distanceMeters: 500 + index * 125,
}));
