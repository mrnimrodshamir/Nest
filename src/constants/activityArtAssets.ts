import type { ImageSourcePropType } from 'react-native';
import type { ActivityCategory } from '@/types/activity';

/** The ONE place a final activity-art file gets wired in. Metro requires
 *  static, literal require() paths — it can't resolve a computed
 *  `require(variable)` — so this map has to be hand-written one line per
 *  category rather than derived from the manifest automatically.
 *
 *  To ship a category's final asset:
 *    1. Drop the file at assets/activity-art/<filename> — see
 *       activityArtManifest.ts for the exact expected filename and spec.
 *    2. Add one line below: `stroller_walk: require('../../assets/activity-art/stroller_walk.jpg'),`
 *    3. Flip that category's `hasArt` to `true` in activityArtManifest.ts.
 *  Nothing else needs to change — CategoryArtwork.tsx (and therefore
 *  every surface that renders a cover: Discovery cards, Activity Detail,
 *  Chats rows, Create Activity preview) picks it up automatically.
 *
 *  Empty today — no final assets exist yet. Every category currently
 *  falls back to the hand-authored SVG scene in CuratedCover.tsx. */
export const ACTIVITY_ART_ASSETS: Partial<Record<ActivityCategory, ImageSourcePropType>> = {
  // stroller_walk: require('../../assets/activity-art/stroller_walk.jpg'),
  // coffee_meetup: require('../../assets/activity-art/coffee_meetup.jpg'),
  // ...one line per category, added as real files land.
};
