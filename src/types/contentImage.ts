export const CONTENT_IMAGE_VARIANTS = ['thumbnail', 'card', 'cover', 'gallery'] as const;
export type ContentImageVariantName = (typeof CONTENT_IMAGE_VARIANTS)[number];

export type ContentImageSourceType = 'official' | 'provider' | 'municipality' | 'curated';
export type ContentImageLicense =
  | 'owned'
  | 'permission_granted'
  | 'public_domain'
  | 'cc_by'
  | 'cc_by_sa'
  | 'open_data'
  | 'unknown';
export type ContentImageRightsStatus = 'pending' | 'approved' | 'rejected';

export interface ContentImageRights {
  sourceType: ContentImageSourceType;
  sourceName: string;
  sourceUrl: string | null;
  attributionText: string | null;
  attributionUrl: string | null;
  license: ContentImageLicense;
  licenseUrl: string | null;
  rightsStatus: ContentImageRightsStatus;
  verifiedAt: string | null;
  verifiedBy: string | null;
}

export interface ContentImageVariant {
  variant: ContentImageVariantName;
  url: string;
  width: number;
  height: number;
  mimeType: string;
  byteSize: number | null;
  sha256: string;
}

/** Provider-neutral media record shared by curated Places and Events. */
export interface ContentImageAsset {
  id: string;
  originalUrl: string;
  originalSha256: string;
  altText: string;
  placeholder: string | null;
  rights: ContentImageRights;
  variants: ContentImageVariant[];
}

export interface ContentImageSet {
  thumbnail: ContentImageAsset | null;
  card: ContentImageAsset | null;
  cover: ContentImageAsset | null;
  gallery: ContentImageAsset[];
}
