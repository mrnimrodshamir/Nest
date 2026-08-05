import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PLACE_CATEGORIES, isPlaceCategory, type FamilyFriendlyPlaceRow } from '@/types/familyFriendlyPlace';
import { formatPlaceAgeRange, formatPlaceDistance, mapFamilyFriendlyPlaceRow, placeMatchesFilters, placeSummaryFeatures } from '@/utils/familyFriendlyPlace';
import { regionToPlaceViewport, validatePlaceQueryInput } from '@/utils/placeViewport';
import { MOCK_FAMILY_FRIENDLY_PLACES } from '@/mocks/mockFamilyFriendlyPlaces';

const row: FamilyFriendlyPlaceRow = {
  id: '1', name: 'Fixture Park', slug: 'fixture-park', category: 'park', short_description: 'Test', full_description: null,
  latitude: 32.08, longitude: 34.78, formatted_address: null, neighborhood: 'Fixture', city: 'Tel Aviv-Yafo', country_code: 'IL',
  provider: null, provider_place_id: null, website_url: null, phone: null, cover_image_url: null, gallery_image_urls: null,
  is_indoor: false, is_outdoor: true, is_free: true, price_note: null, min_age_months: 6, max_age_months: 60,
  stroller_friendly: true, changing_table: false, high_chairs: false, toilets: true, shade: true, water_fountain: true,
  accessible: true, parking_note: null, opening_hours: null, source_name: 'Fixture', source_url: null,
  verification_status: 'verified', last_verified_at: null, is_active: true,
};

test('approved category set is exact and rejects unknown values', () => { assert.equal(PLACE_CATEGORIES.length, 13); assert.equal(isPlaceCategory('family_cafe'), true); assert.equal(isPlaceCategory('coffee_meetup'), false); });
test('database row maps to the permanent app model and handles missing address', () => { const place = mapFamilyFriendlyPlaceRow(row); assert.equal(place.shortDescription, 'Test'); assert.equal(place.formattedAddress, null); assert.equal(place.distanceMeters, null); });
test('malformed coordinates are rejected', () => assert.throws(() => mapFamilyFriendlyPlaceRow({ ...row, latitude: 100 }), /latitude/));
test('viewport conversion and result cap are safe', () => { const viewport = regionToPlaceViewport({ latitude: 32.08, longitude: 34.78, latitudeDelta: .04, longitudeDelta: .02 }); assert.deepEqual(viewport, { north: 32.1, south: 32.059999999999995, east: 34.79, west: 34.77 }); assert.equal(validatePlaceQueryInput({ viewport, limit: 999 }).limit, 100); });
test('active/verified, category, environment, cost and age filters compose', () => { const place = mapFamilyFriendlyPlaceRow(row); assert.equal(placeMatchesFilters(place, { category: 'park', environment: 'outdoor', cost: 'free', ageMonths: 24 }), true); assert.equal(placeMatchesFilters({ ...place, verificationStatus: 'draft' }, {}), false); assert.equal(placeMatchesFilters(place, { ageMonths: 72 }), false); assert.equal(placeMatchesFilters(place, { environment: 'indoor' }), false); });
test('distance and card features stay compact', () => { const place = mapFamilyFriendlyPlaceRow({ ...row, distance_meters: 1230 }); assert.equal(formatPlaceDistance(place.distanceMeters), '1.2 km away'); assert.deepEqual(placeSummaryFeatures(place), ['Shade','Toilets','Stroller friendly']); });
test('details age helper handles bounded and open ranges', () => { assert.equal(formatPlaceAgeRange(6, 36), '6 months – 3 years'); assert.equal(formatPlaceAgeRange(null, 24), 'Up to 2 years'); });
test('development fixtures are fictional, varied, and never verified', () => { assert.equal(MOCK_FAMILY_FRIENDLY_PLACES.length, 12); assert.equal(new Set(MOCK_FAMILY_FRIENDLY_PLACES.map((place) => place.category)).size, 12); assert.ok(MOCK_FAMILY_FRIENDLY_PLACES.every((place) => place.sourceName === 'Development fixture' && place.verificationStatus === 'draft')); });
test('query layer explicitly enforces viewport, active/verified and every approved filter', () => { const source = readFileSync(new URL('../lib/familyFriendlyPlaces.ts', import.meta.url), 'utf8'); for (const token of ["eq('is_active', true)", "eq('verification_status', 'verified')", "gte('latitude'", "lte('longitude'", "eq('is_indoor', true)", "eq('is_outdoor', true)", "eq('is_free', true)", 'min_age_months', 'max_age_months']) assert.match(source, new RegExp(token.replace(/[()'.]/g, '\\$&'))); });
test('place markers have category mapping and stay distinct from activity markers', () => { const placePin = readFileSync(new URL('../components/PlaceMapPin.tsx', import.meta.url), 'utf8'); const activityPin = readFileSync(new URL('../components/ActivityMapPin.tsx', import.meta.url), 'utf8'); assert.match(placePin, /borderRadius: 8/); assert.match(activityPin, /borderRadius: 19/); });
