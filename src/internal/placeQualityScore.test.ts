import test from 'node:test';
import assert from 'node:assert/strict';
import { calculatePlaceQuality } from '@/internal/placeQualityScore';
test('complete place scores 100', () => assert.deepEqual(calculatePlaceQuality({ coverImageUrl:'https://x.test/a.jpg',shortDescription:'Useful',openingHours:{Mon:'9-5'},websiteUrl:'https://x.test',accessible:true,strollerFriendly:true }), { score:100, gaps:[] }));
test('missing fields produce weighted, actionable gaps', () => { const result = calculatePlaceQuality({}); assert.equal(result.score, 0); assert.deepEqual(result.gaps, ['image','description','hours','website','accessibility','family_metadata']); });
