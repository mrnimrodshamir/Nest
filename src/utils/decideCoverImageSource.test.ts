import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decideCoverImageSource } from './decideCoverImageSource.ts';

test('decideCoverImageSource: an uploaded photo overrides the category artwork', () => {
  const result = decideCoverImageSource({
    url: 'https://example.com/my-photo.jpg',
    isCuratedUrl: false,
    uploadFailed: false,
  });
  assert.equal(result, 'uploaded-photo');
});

test('decideCoverImageSource: no url at all falls back to category artwork', () => {
  const result = decideCoverImageSource({ url: null, isCuratedUrl: false, uploadFailed: false });
  assert.equal(result, 'category-art');
});

test('decideCoverImageSource: an uploaded photo that failed to load safely falls back to category artwork, not a blank space', () => {
  const result = decideCoverImageSource({
    url: 'https://example.com/broken.jpg',
    isCuratedUrl: false,
    uploadFailed: true,
  });
  assert.equal(result, 'category-art');
});

test('decideCoverImageSource: a legacy curated: URL renders the placeholder scene, taking priority over everything else', () => {
  const result = decideCoverImageSource({
    url: 'curated:stroller_walk',
    isCuratedUrl: true,
    uploadFailed: false,
  });
  assert.equal(result, 'curated-placeholder');
});
