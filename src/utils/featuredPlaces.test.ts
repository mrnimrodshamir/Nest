import test from 'node:test';
import assert from 'node:assert/strict';
import { rankFeaturedCandidates, type FeaturedPlaceCandidate } from '@/utils/featuredPlaces';
const rows: FeaturedPlaceCandidate[] = [{ id:'a',name:'Alpha',isFeatured:true,featuredOrder:2,featuredUntil:null,createdAt:'2026-01-01',popularityScore:3 },{ id:'b',name:'Beta',isFeatured:true,featuredOrder:1,featuredUntil:'2027-01-01',createdAt:'2026-08-01',popularityScore:10 },{ id:'c',name:'Charlie',isFeatured:true,featuredOrder:0,featuredUntil:'2025-01-01',createdAt:'2026-06-01',popularityScore:1 }];
test('featured content is ordered and expired entries are excluded', () => assert.deepEqual(rankFeaturedCandidates(rows, 'featured_this_week', new Date('2026-08-05')).map((row) => row.id), ['b','a']));
test('new and popular sections are data-driven', () => { assert.deepEqual(rankFeaturedCandidates(rows, 'new_places').map((row) => row.id), ['b','c','a']); assert.deepEqual(rankFeaturedCandidates(rows, 'popular_places').map((row) => row.id), ['b','a','c']); });
