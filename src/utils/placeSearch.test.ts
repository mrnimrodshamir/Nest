import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { normalizePlaceSearchQuery } from '@/utils/placeSearch';
test('search normalizes Hebrew and English while rejecting short input', () => { assert.equal(normalizePlaceSearchQuery('  family   café  '), 'family café'); assert.equal(normalizePlaceSearchQuery('  פארק  הירקון '), 'פארק הירקון'); assert.equal(normalizePlaceSearchQuery('a'), null); });
test('search index includes collections and future partner tags', () => { const sql = readFileSync(new URL('../../supabase/migrations/0007_places_curation_platform.sql', import.meta.url), 'utf8'); assert.match(sql, /partner_tags/); assert.match(sql, /place_collection_items/); assert.match(sql, /search_document/); assert.match(sql, /websearch_to_tsquery/); });
