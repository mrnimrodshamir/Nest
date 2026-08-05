import test from 'node:test';
import assert from 'node:assert/strict';
import { clusterPlacesForRegion } from '@/utils/placeClustering';
import { MOCK_FAMILY_FRIENDLY_PLACES } from '@/mocks/mockFamilyFriendlyPlaces';
test('small result sets remain individually selectable', () => assert.ok(clusterPlacesForRegion(MOCK_FAMILY_FRIENDLY_PLACES, { latitudeDelta:.04, longitudeDelta:.04 }).every((item) => item.kind === 'place')));
test('thousands of markers cluster within a small render budget', () => { const places = Array.from({ length:5000 }, (_, i) => ({ ...MOCK_FAMILY_FRIENDLY_PLACES[i % 12], id:`p${i}`, latitude:32.05 + (i % 100) * .0005, longitude:34.75 + Math.floor(i / 100) * .0005 })); const started = performance.now(); const clustered = clusterPlacesForRegion(places, { latitudeDelta:.1, longitudeDelta:.1 }, 45); assert.ok(clustered.length < 150); assert.ok(performance.now() - started < 500); });
