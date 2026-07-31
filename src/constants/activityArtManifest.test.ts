import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVITY_ART_MANIFEST, ACTIVITY_ART_SPEC } from './activityArtManifest.ts';

const EXPECTED_CATEGORIES = [
  'stroller_walk', 'coffee_meetup', 'baby_playtime', 'playground_meetup', 'picnic',
  'breakfast_meetup', 'lunch_meetup', 'beach', 'indoor_playground', 'story_time',
  'music_activity', 'swimming', 'fitness', 'yoga', 'workshop', 'museum', 'zoo',
  'shopping_together', 'moms_night_out', 'support_circle', 'other',
];

test('activityArtManifest: has exactly the 21 expected categories, no duplicates', () => {
  const categories = ACTIVITY_ART_MANIFEST.map((e) => e.category);
  assert.equal(categories.length, 21);
  assert.equal(new Set(categories).size, 21);
  for (const expected of EXPECTED_CATEGORIES) {
    assert.ok(categories.includes(expected), `missing category: ${expected}`);
  }
});

test('activityArtManifest: every filename is a .jpg matching its category name', () => {
  for (const entry of ACTIVITY_ART_MANIFEST) {
    assert.equal(entry.filename, `${entry.category}.jpg`);
  }
});

test('activityArtManifest: every category has final art installed (hasArt: true)', () => {
  for (const entry of ACTIVITY_ART_MANIFEST) {
    assert.equal(entry.hasArt, true, `${entry.category} is missing final art`);
  }
});

test('activityArtManifest: filenames are unique (no two categories overwrite the same file)', () => {
  const filenames = ACTIVITY_ART_MANIFEST.map((e) => e.filename);
  assert.equal(new Set(filenames).size, filenames.length);
});

test('ACTIVITY_ART_SPEC: matches the installed asset dimensions and budget', () => {
  assert.equal(ACTIVITY_ART_SPEC.width, 1200);
  assert.equal(ACTIVITY_ART_SPEC.height, 900);
  assert.equal(ACTIVITY_ART_SPEC.maxFileSizeKB, 220);
});
