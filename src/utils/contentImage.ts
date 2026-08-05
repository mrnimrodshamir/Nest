import {
  CONTENT_IMAGE_VARIANTS,
  type ContentImageAsset,
  type ContentImageVariant,
  type ContentImageVariantName,
} from '@/types/contentImage';

const SHA256 = /^[a-f0-9]{64}$/i;

export function isSafeContentImageUrl(value: string | null): boolean {
  if (!value) return false;
  try { return new URL(value).protocol === 'https:'; } catch { return false; }
}

export function validateContentImage(asset: ContentImageAsset): string[] {
  const errors: string[] = [];
  if (!asset.id.trim()) errors.push('id is required');
  if (!asset.altText.trim()) errors.push('altText is required');
  if (!isSafeContentImageUrl(asset.originalUrl)) errors.push('originalUrl must be HTTPS');
  if (!SHA256.test(asset.originalSha256)) errors.push('originalSha256 must be a SHA-256 hex digest');
  if (!asset.rights.sourceName.trim()) errors.push('rights.sourceName is required');
  if (asset.rights.sourceUrl && !isSafeContentImageUrl(asset.rights.sourceUrl)) errors.push('rights.sourceUrl must be HTTPS');
  if (asset.rights.attributionUrl && !isSafeContentImageUrl(asset.rights.attributionUrl)) errors.push('rights.attributionUrl must be HTTPS');
  if (asset.rights.licenseUrl && !isSafeContentImageUrl(asset.rights.licenseUrl)) errors.push('rights.licenseUrl must be HTTPS');
  if (asset.rights.rightsStatus === 'approved' && (!asset.rights.verifiedAt || asset.rights.license === 'unknown')) {
    errors.push('approved images require a known license and verification timestamp');
  }
  const variants = new Set<ContentImageVariantName>();
  for (const variant of asset.variants) {
    if (!CONTENT_IMAGE_VARIANTS.includes(variant.variant)) errors.push(`unsupported variant: ${variant.variant}`);
    if (variants.has(variant.variant)) errors.push(`duplicate variant: ${variant.variant}`);
    variants.add(variant.variant);
    if (!isSafeContentImageUrl(variant.url)) errors.push(`${variant.variant} URL must be HTTPS`);
    if (!Number.isInteger(variant.width) || variant.width <= 0 || !Number.isInteger(variant.height) || variant.height <= 0) errors.push(`${variant.variant} dimensions are invalid`);
    if (!SHA256.test(variant.sha256)) errors.push(`${variant.variant} sha256 is invalid`);
  }
  return errors;
}

export function canPublishContentImage(asset: ContentImageAsset): boolean {
  return validateContentImage(asset).length === 0 && asset.rights.rightsStatus === 'approved';
}

const FALLBACKS: Record<ContentImageVariantName, ContentImageVariantName[]> = {
  thumbnail: ['thumbnail', 'card', 'cover', 'gallery'],
  card: ['card', 'cover', 'thumbnail', 'gallery'],
  cover: ['cover', 'gallery', 'card', 'thumbnail'],
  gallery: ['gallery', 'cover', 'card', 'thumbnail'],
};

export function selectContentImageVariant(asset: ContentImageAsset | null, requested: ContentImageVariantName): ContentImageVariant | null {
  if (!asset || !canPublishContentImage(asset)) return null;
  for (const name of FALLBACKS[requested]) {
    const variant = asset.variants.find((item) => item.variant === name);
    if (variant) return variant;
  }
  return null;
}

export type ContentImageDuplicateMatch =
  | { kind: 'exact_hash'; imageId: string }
  | { kind: 'same_source'; imageId: string }
  | { kind: 'none' };

export function findContentImageDuplicate(candidate: Pick<ContentImageAsset, 'originalSha256' | 'originalUrl'>, existing: ContentImageAsset[]): ContentImageDuplicateMatch {
  const hash = candidate.originalSha256.toLowerCase();
  const exact = existing.find((asset) => asset.originalSha256.toLowerCase() === hash);
  if (exact) return { kind: 'exact_hash', imageId: exact.id };
  const sourceUrl = normalizeUrl(candidate.originalUrl);
  const sameSource = existing.find((asset) => normalizeUrl(asset.originalUrl) === sourceUrl);
  return sameSource ? { kind: 'same_source', imageId: sameSource.id } : { kind: 'none' };
}

function normalizeUrl(value: string): string {
  try {
    const url = new URL(value);
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (key.toLowerCase().startsWith('utm_')) url.searchParams.delete(key);
    return url.toString().replace(/\/$/, '').toLowerCase();
  } catch { return value.trim().toLowerCase(); }
}
