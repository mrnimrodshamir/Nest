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
 *  All 21 final assets installed. Nothing falls back to the SVG scene
 *  in CuratedCover.tsx anymore. */
export const ACTIVITY_ART_ASSETS: Partial<Record<ActivityCategory, ImageSourcePropType>> = {
  stroller_walk: require('../../assets/activity-art/stroller_walk.jpg'),
  coffee_meetup: require('../../assets/activity-art/coffee_meetup.jpg'),
  baby_playtime: require('../../assets/activity-art/baby_playtime.jpg'),
  playground_meetup: require('../../assets/activity-art/playground_meetup.jpg'),
  picnic: require('../../assets/activity-art/picnic.jpg'),
  breakfast_meetup: require('../../assets/activity-art/breakfast_meetup.jpg'),
  lunch_meetup: require('../../assets/activity-art/lunch_meetup.jpg'),
  beach: require('../../assets/activity-art/beach.jpg'),
  indoor_playground: require('../../assets/activity-art/indoor_playground.jpg'),
  story_time: require('../../assets/activity-art/story_time.jpg'),
  music_activity: require('../../assets/activity-art/music_activity.jpg'),
  swimming: require('../../assets/activity-art/swimming.jpg'),
  fitness: require('../../assets/activity-art/fitness.jpg'),
  yoga: require('../../assets/activity-art/yoga.jpg'),
  workshop: require('../../assets/activity-art/workshop.jpg'),
  museum: require('../../assets/activity-art/museum.jpg'),
  zoo: require('../../assets/activity-art/zoo.jpg'),
  shopping_together: require('../../assets/activity-art/shopping_together.jpg'),
  moms_night_out: require('../../assets/activity-art/moms_night_out.jpg'),
  support_circle: require('../../assets/activity-art/support_circle.jpg'),
  other: require('../../assets/activity-art/other.jpg'),
};
