/** The three purpose-built art sizes every category has, one asset each —
 *  never shared, never cropped into a different shape at render time. See
 *  activityArtManifest.ts for the exact spec (dimensions, aspect ratio,
 *  file size budget) each variant must meet. */
export type ActivityArtVariant = 'thumb' | 'card' | 'hero';

export const ACTIVITY_ART_VARIANTS: readonly ActivityArtVariant[] = ['thumb', 'card', 'hero'];
