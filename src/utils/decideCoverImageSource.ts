export type CoverImageSourceKind = 'curated-placeholder' | 'uploaded-photo' | 'category-art';

/** The pure decision behind CoverImage's render branch — pulled out so the
 *  override/fallback rules are unit-testable without rendering a React
 *  Native Image. An uploaded photo always wins over the category's
 *  automatic artwork, UNLESS it failed to load, in which case the category
 *  art is the safe fallback rather than a blank space. */
export function decideCoverImageSource(params: {
  url: string | null;
  isCuratedUrl: boolean;
  uploadFailed: boolean;
}): CoverImageSourceKind {
  if (params.isCuratedUrl) return 'curated-placeholder';
  if (params.url && !params.uploadFailed) return 'uploaded-photo';
  return 'category-art';
}
