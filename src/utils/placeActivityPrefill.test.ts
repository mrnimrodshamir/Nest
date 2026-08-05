import test from 'node:test';
import assert from 'node:assert/strict';
import { MOCK_FAMILY_FRIENDLY_PLACES } from '@/mocks/mockFamilyFriendlyPlaces';
import { activityCategoryForPlace, buildActivitySeedFromPlace } from '@/utils/placeActivityPrefill';

test('obvious place categories suggest an editable activity category', () => { assert.equal(activityCategoryForPlace('playground'), 'playground_meetup'); assert.equal(activityCategoryForPlace('family_cafe'), 'coffee_meetup'); assert.equal(activityCategoryForPlace('other'), 'other'); });
test('Create activity here prefills location without mutating the curated place', () => { const place = { ...MOCK_FAMILY_FRIENDLY_PLACES[0], provider: 'apple_maps', providerPlaceId: 'provider-1', verificationStatus: 'verified' as const }; const before = structuredClone(place); const seed = buildActivitySeedFromPlace(place); assert.deepEqual(place, before); assert.equal(seed.locationName, place.name); assert.equal(seed.selectedLocation?.place?.providerPlaceId, 'provider-1'); assert.equal(seed.selectedLocation?.source, 'provider'); assert.equal(seed.description, ''); });
test('curated places without provider identity remain manual but preserve category metadata', () => { const seed = buildActivitySeedFromPlace(MOCK_FAMILY_FRIENDLY_PLACES[1]); assert.equal(seed.selectedLocation?.place?.provider, null); assert.equal(seed.selectedLocation?.place?.category, 'park'); assert.equal(seed.selectedLocation?.source, 'manual'); assert.equal(seed.latitude, MOCK_FAMILY_FRIENDLY_PLACES[1].latitude); });
