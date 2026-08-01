import type { ImageSourcePropType } from 'react-native';
import type { ActivityCategory } from '@/types/activity';
import type { ActivityArtVariant } from './activityArtVariant';

/** The ONE place a final activity-art file gets wired in. Metro requires
 *  static, literal require() paths — it can't resolve a computed
 *  `require(variable)` — so this map has to be hand-written one line per
 *  category+variant rather than derived from the manifest automatically.
 *
 *  To ship a category's final asset for one variant:
 *    1. Drop the file at assets/activity-art/<filename> — see
 *       activityArtManifest.ts for the exact expected filename per variant.
 *    2. Add one line below, e.g.:
 *       stroller_walk: { thumb: require('../../assets/activity-art/stroller_walk_thumb.jpg') }
 *  Nothing else needs to change — CategoryArtwork.tsx (and therefore every
 *  surface that renders a cover) picks it up automatically via
 *  resolveActivityArt.ts.
 *
 *  Only stroller_walk is installed so far (a style-proof batch) — every
 *  other category still falls back through resolveActivityArt's "other"
 *  variant, then to CuratedCover's aspect-neutral placeholder scene, until
 *  the rest of the 63-file library is supplied. Do NOT add a require() for
 *  a file that doesn't exist yet — Metro fails the entire bundle on a
 *  missing static asset. */
export const ACTIVITY_ART_ASSETS: Partial<
  Record<ActivityCategory, Partial<Record<ActivityArtVariant, ImageSourcePropType>>>
> = {
  stroller_walk: {
    thumb: require('../../assets/activity-art/stroller_walk_thumb.jpg'),
    card: require('../../assets/activity-art/stroller_walk_card.jpg'),
    hero: require('../../assets/activity-art/stroller_walk_hero.jpg'),
  },
};
