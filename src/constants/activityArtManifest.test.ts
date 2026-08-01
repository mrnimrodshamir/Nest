import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVITY_ART_MANIFEST, ACTIVITY_ART_VARIANT_SPEC } from './activityArtManifest.ts';
import { ACTIVITY_ART_VARIANTS } from './activityArtVariant.ts';

const EXPECTED_CATEGORIES = [
  'stroller_walk', 'coffee_meetup', 'baby_playtime', 'playground_meetup', 'picnic',
  'breakfast_meetup', 'lunch_meetup', 'beach', 'indoor_playground', 'story_time',
  'music_activity', 'swimming', 'fitness', 'yoga', 'workshop', 'museum', 'zoo',
  'shopping_together', 'moms_night_out', 'support_circle', 'other',
];

test('activityArtManifest: has exactly the 21 expected categories, no duplicates', () => {
  const categories = Object.keys(ACTIVITY_ART_MANIFEST);
  assert.equal(categories.length, 21);
  assert.equal(new Set(categories).size, 21);
  for (const expected of EXPECTED_CATEGORIES) {
    assert.ok(categories.includes(expected), `missing category: ${expected}`);
  }
});

test('activityArtManifest: every category has all three variants (thumb, card, hero)', () => {
  const categories = Object.keys(ACTIVITY_ART_MANIFEST);
  for (const category of categories) {
    const entry = ACTIVITY_ART_MANIFEST[category];
    for (const variant of ACTIVITY_ART_VARIANTS) {
      assert.ok(entry[variant], `${category} is missing the "${variant}" variant`);
      assert.ok(entry[variant].filename, `${category}'s "${variant}" entry has no filename`);
    }
  }
});

test('activityArtManifest: every filename matches the {category}_{variant}.jpg pattern', () => {
  const categories = Object.keys(ACTIVITY_ART_MANIFEST);
  for (const category of categories) {
    const entry = ACTIVITY_ART_MANIFEST[category];
    for (const variant of ACTIVITY_ART_VARIANTS) {
      assert.equal(entry[variant].filename, `${category}_${variant}.jpg`);
    }
  }
});

test('activityArtManifest: all 63 filenames are unique across every category and variant', () => {
  const categories = Object.keys(ACTIVITY_ART_MANIFEST);
  const filenames = [];
  for (const category of categories) {
    for (const variant of ACTIVITY_ART_VARIANTS) {
      filenames.push(ACTIVITY_ART_MANIFEST[category][variant].filename);
    }
  }
  assert.equal(filenames.length, 63);
  assert.equal(new Set(filenames).size, 63);
});

test('ACTIVITY_ART_VARIANT_SPEC: thumb is a compact 4:3 image', () => {
  assert.equal(ACTIVITY_ART_VARIANT_SPEC.thumb.width, 600);
  assert.equal(ACTIVITY_ART_VARIANT_SPEC.thumb.height, 450);
  assert.equal(ACTIVITY_ART_VARIANT_SPEC.thumb.aspectRatio, '4:3');
});

test('ACTIVITY_ART_VARIANT_SPEC: card is a native 16:9 banner, not a crop of the 4:3 source', () => {
  assert.equal(ACTIVITY_ART_VARIANT_SPEC.card.width, 1600);
  assert.equal(ACTIVITY_ART_VARIANT_SPEC.card.height, 900);
  assert.equal(ACTIVITY_ART_VARIANT_SPEC.card.aspectRatio, '16:9');
});

test('ACTIVITY_ART_VARIANT_SPEC: hero matches the largest display surfaces at 4:3', () => {
  assert.equal(ACTIVITY_ART_VARIANT_SPEC.hero.width, 1200);
  assert.equal(ACTIVITY_ART_VARIANT_SPEC.hero.height, 900);
  assert.equal(ACTIVITY_ART_VARIANT_SPEC.hero.aspectRatio, '4:3');
});
