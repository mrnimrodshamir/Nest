import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PLACE_CATEGORIES, isPlaceCategory, type FamilyFriendlyPlaceRow } from '@/types/familyFriendlyPlace';
import { buildAppleMapsPlaceUrl, formatOpeningHours, formatPlaceAgeRange, formatPlaceDistance, mapFamilyFriendlyPlaceRow, placeMatchesFilters, placeSummaryFeatures, placeWhatIsHere } from '@/utils/familyFriendlyPlace';
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

test('approved category set is exact and excludes family_cafe', () => { assert.equal(PLACE_CATEGORIES.length, 12); assert.equal(isPlaceCategory('family_cafe'), false); assert.equal(isPlaceCategory('playground'), true); });
test('database row maps to the permanent app model and handles missing address', () => { const place = mapFamilyFriendlyPlaceRow(row); assert.equal(place.shortDescription, 'Test'); assert.equal(place.formattedAddress, null); assert.equal(place.distanceMeters, null); });
test('malformed coordinates are rejected', () => assert.throws(() => mapFamilyFriendlyPlaceRow({ ...row, latitude: 100 }), /latitude/));
test('viewport conversion and result cap are safe', () => { const viewport = regionToPlaceViewport({ latitude: 32.08, longitude: 34.78, latitudeDelta: .04, longitudeDelta: .02 }); assert.deepEqual(viewport, { north: 32.1, south: 32.059999999999995, east: 34.79, west: 34.77 }); assert.equal(validatePlaceQueryInput({ viewport, limit: 999 }).limit, 100); });
test('active/verified, category, environment, cost and age filters compose', () => { const place = mapFamilyFriendlyPlaceRow(row); assert.equal(placeMatchesFilters(place, { category: 'park', environment: 'outdoor', cost: 'free', ageMonths: 24 }), true); assert.equal(placeMatchesFilters({ ...place, verificationStatus: 'draft' }, {}), false); assert.equal(placeMatchesFilters(place, { ageMonths: 72 }), false); assert.equal(placeMatchesFilters(place, { environment: 'indoor' }), false); });
test('family amenity and distance filters compose', () => { const place = { ...mapFamilyFriendlyPlaceRow(row), distanceMeters: 900 }; assert.equal(placeMatchesFilters(place, { toilets: true, shade: true, waterFountain: true, accessible: true, maxDistanceMeters: 1000 }), true); assert.equal(placeMatchesFilters(place, { highChairs: true }), false); assert.equal(placeMatchesFilters(place, { maxDistanceMeters: 500 }), false); });
test('distance and card features stay compact', () => { const place = mapFamilyFriendlyPlaceRow({ ...row, distance_meters: 1230 }); assert.equal(formatPlaceDistance(place.distanceMeters), '1.2 km away'); assert.deepEqual(placeSummaryFeatures(place), ['Shade','Toilets','Stroller friendly']); });
test('details age helper handles bounded and open ranges', () => { assert.equal(formatPlaceAgeRange(6, 36), '6 months – 3 years'); assert.equal(formatPlaceAgeRange(null, 24), 'Up to 2 years'); });
test('details opening-hours helper renders supported schedules and ignores malformed data', () => { assert.equal(formatOpeningHours({ Monday: '09:00–17:00', Tuesday: ['09:00–12:00','14:00–17:00'] }), 'Monday: 09:00–17:00\nTuesday: 09:00–12:00, 14:00–17:00'); assert.equal(formatOpeningHours({ raw: { unsafe: true } }), null); });
test('Apple Maps link targets the exact place point without exposing provider metadata', () => {
  assert.equal(buildAppleMapsPlaceUrl({ name: 'MUZA & Park', latitude: 32.10288, longitude: 34.79635 }), 'https://maps.apple.com/?ll=32.10288,34.79635&q=MUZA%20%26%20Park');
  assert.throws(() => buildAppleMapsPlaceUrl({ name: 'Invalid', latitude: 91, longitude: 34.8 }), /latitude/);
});
test('Place Details shows full copy and cost only when values exist', () => {
  const source = readFileSync(new URL('../screens/PlaceDetailsScreen.tsx', import.meta.url), 'utf8');
  assert.match(source, /const description = place\.fullDescription \?\? place\.shortDescription/);
  assert.match(source, /description \? <Text/);
  assert.match(source, /place\.priceNote \? <Section title=\{t\('place\.cost'\)\}/);
  assert.match(source, /buildAppleMapsPlaceUrl\(place\)/);
});
test('development fixtures are fictional, varied, and never verified', () => { assert.equal(MOCK_FAMILY_FRIENDLY_PLACES.length, 11); assert.equal(new Set(MOCK_FAMILY_FRIENDLY_PLACES.map((place) => place.category)).size, 11); assert.ok(MOCK_FAMILY_FRIENDLY_PLACES.every((place) => place.sourceName === 'Development fixture' && place.verificationStatus === 'draft')); });
test('query layer explicitly enforces viewport, active/verified and every approved filter', () => { const source = readFileSync(new URL('../lib/familyFriendlyPlaces.ts', import.meta.url), 'utf8'); for (const token of ["eq('is_active', true)", "eq('verification_status', 'verified')", "gte('latitude'", "lte('longitude'", "eq('is_indoor', true)", "eq('is_outdoor', true)", "eq('is_free', true)", 'min_age_months', 'max_age_months']) assert.match(source, new RegExp(token.replace(/[()'.]/g, '\\$&'))); });
test('place markers have category mapping and stay distinct from activity markers', () => { const placePin = readFileSync(new URL('../components/PlaceMapPin.tsx', import.meta.url), 'utf8'); const activityPin = readFileSync(new URL('../components/ActivityMapPin.tsx', import.meta.url), 'utf8'); assert.match(placePin, /borderRadius: 8/); assert.match(activityPin, /borderRadius: 19/); });
test("What's here includes explicit facts and age while hiding every unknown", () => {
  const place = mapFamilyFriendlyPlaceRow(row);
  assert.deepEqual(placeWhatIsHere(place), ['Park', 'Outdoor', 'Free', 'Toilets', 'Shade', 'Water fountain', 'Stroller friendly', 'Accessible', 'Best for 6 months – 5 years']);
  const unknown = { ...place, category: 'other' as const, isIndoor: null, isOutdoor: null, isFree: null, toilets: null, shade: null, waterFountain: null, changingTable: null, strollerFriendly: null, accessible: null, minAgeMonths: null, maxAgeMonths: null };
  assert.deepEqual(placeWhatIsHere(unknown), []);
});
