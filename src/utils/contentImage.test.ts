import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import type { ContentImageAsset } from '@/types/contentImage';
import {
  canPublishContentImage,
  findContentImageDuplicate,
  selectContentImageVariant,
  validateContentImage,
} from '@/utils/contentImage';

const A = 'a'.repeat(64);
const B = 'b'.repeat(64);
const asset = (overrides: Partial<ContentImageAsset> = {}): ContentImageAsset => ({
  id: 'image-1',
  originalUrl: 'https://venue.example/images/park.jpg',
  originalSha256: A,
  altText: 'Children playing in a park',
  placeholder: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
  rights: {
    sourceType: 'official', sourceName: 'Official venue', sourceUrl: 'https://venue.example',
    attributionText: 'Photo courtesy of Official venue', attributionUrl: null,
    license: 'permission_granted', licenseUrl: null, rightsStatus: 'approved',
    verifiedAt: '2026-08-05T00:00:00Z', verifiedBy: 'curator-1',
  },
  variants: [
    { variant: 'thumbnail', url: 'https://cdn.example/thumb.webp', width: 160, height: 120, mimeType: 'image/webp', byteSize: 12000, sha256: B },
    { variant: 'cover', url: 'https://cdn.example/cover.webp', width: 1200, height: 900, mimeType: 'image/webp', byteSize: 180000, sha256: 'c'.repeat(64) },
  ],
  ...overrides,
});

test('validates approved licensing metadata, hashes, URLs, and dimensions', () => {
  assert.deepEqual(validateContentImage(asset()), []);
  assert.equal(canPublishContentImage(asset()), true);
  assert.ok(validateContentImage(asset({ originalUrl: 'http://insecure.example/a.jpg' })).includes('originalUrl must be HTTPS'));
  assert.ok(validateContentImage(asset({ originalSha256: 'bad' })).some((error) => error.includes('SHA-256')));
});

test('unknown or unverified rights cannot be published', () => {
  const pending = asset({ rights: { ...asset().rights, rightsStatus: 'pending', license: 'unknown', verifiedAt: null } });
  assert.equal(canPublishContentImage(pending), false);
  const invalidApproval = asset({ rights: { ...asset().rights, license: 'unknown', verifiedAt: null } });
  assert.ok(validateContentImage(invalidApproval).some((error) => error.includes('known license')));
});

test('selects requested variants and deterministic lower-cost fallbacks', () => {
  assert.equal(selectContentImageVariant(asset(), 'cover')?.variant, 'cover');
  assert.equal(selectContentImageVariant(asset(), 'card')?.variant, 'cover');
  assert.equal(selectContentImageVariant(asset(), 'gallery')?.variant, 'cover');
  assert.equal(selectContentImageVariant(null, 'card'), null);
});

test('detects exact hash duplicates before normalized source URL candidates', () => {
  const existing = [asset()];
  assert.deepEqual(findContentImageDuplicate({ originalSha256: A.toUpperCase(), originalUrl: 'https://other.example/a.jpg' }, existing), { kind: 'exact_hash', imageId: 'image-1' });
  assert.deepEqual(findContentImageDuplicate({ originalSha256: 'd'.repeat(64), originalUrl: 'https://venue.example/images/park.jpg?utm_source=x' }, existing), { kind: 'same_source', imageId: 'image-1' });
  assert.deepEqual(findContentImageDuplicate({ originalSha256: 'e'.repeat(64), originalUrl: 'https://new.example/a.jpg' }, existing), { kind: 'none' });
});

test('renderer uses caching, lazy interaction loading, placeholder, and broken-image fallback', () => {
  const source = readFileSync(new URL('../components/ContentImage.tsx', import.meta.url), 'utf8');
  assert.match(source, /cachePolicy="memory-disk"/);
  assert.match(source, /InteractionManager\.runAfterInteractions/);
  assert.match(source, /placeholder=/);
  assert.match(source, /onError=/);
  assert.match(source, /recyclingKey=/);
});

test('gallery is virtualized and does not render unapproved assets', () => {
  const source = readFileSync(new URL('../components/ContentImageGallery.tsx', import.meta.url), 'utf8');
  assert.match(source, /rightsStatus === 'approved'/);
  assert.match(source, /<FlatList/);
  assert.match(source, /removeClippedSubviews/);
  assert.match(source, /initialNumToRender=\{2\}/);
});

test('database schema is additive, rights-aware, hash-deduplicated, and supports Places and Events', () => {
  const migration = readFileSync(new URL('../../supabase/migrations/0010_content_image_pipeline.sql', import.meta.url), 'utf8');
  for (const table of ['content_images', 'content_image_variants', 'place_content_images', 'event_content_images']) assert.match(migration, new RegExp(`create table if not exists public\\.${table}`));
  assert.match(migration, /unique \(original_sha256\)/);
  assert.match(migration, /rights_status = 'approved'/);
  assert.match(migration, /Existing cover_image_url, gallery_image_urls, and events\.image_url remain readable/);
  assert.match(migration, /ROLLBACK/);
  assert.doesNotMatch(migration, /drop column|alter column|delete from|truncate/i);
});

test('image pipeline contains no scraper or provider download implementation', () => {
  const utility = readFileSync(new URL('./contentImage.ts', import.meta.url), 'utf8');
  const component = readFileSync(new URL('../components/ContentImage.tsx', import.meta.url), 'utf8');
  assert.doesNotMatch(`${utility}\n${component}`, /fetch\(|axios|scrape|crawler/i);
});
