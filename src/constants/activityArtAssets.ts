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
 *  All 21 categories x 3 variants (63 files) are installed. Every entry
 *  below has a real file on disk, so resolveActivityArt never falls through
 *  to the "other" substitution or CuratedCover's placeholder scene for a
 *  known category — that path now only handles an unknown//future category
 *  key coming back from the DB. Do NOT add a require() for a file that
 *  doesn't exist yet — Metro fails the entire bundle on a missing static
 *  asset. */
export const ACTIVITY_ART_ASSETS: Partial<
  Record<ActivityCategory, Partial<Record<ActivityArtVariant, ImageSourcePropType>>>
> = {
  stroller_walk: {
    thumb: require('../../assets/activity-art/stroller_walk_thumb.jpg'),
    card: require('../../assets/activity-art/stroller_walk_card.jpg'),
    hero: require('../../assets/activity-art/stroller_walk_hero.jpg'),
  },
  coffee_meetup: {
    thumb: require('../../assets/activity-art/coffee_meetup_thumb.jpg'),
    card: require('../../assets/activity-art/coffee_meetup_card.jpg'),
    hero: require('../../assets/activity-art/coffee_meetup_hero.jpg'),
  },
  baby_playtime: {
    thumb: require('../../assets/activity-art/baby_playtime_thumb.jpg'),
    card: require('../../assets/activity-art/baby_playtime_card.jpg'),
    hero: require('../../assets/activity-art/baby_playtime_hero.jpg'),
  },
  playground_meetup: {
    thumb: require('../../assets/activity-art/playground_meetup_thumb.jpg'),
    card: require('../../assets/activity-art/playground_meetup_card.jpg'),
    hero: require('../../assets/activity-art/playground_meetup_hero.jpg'),
  },
  picnic: {
    thumb: require('../../assets/activity-art/picnic_thumb.jpg'),
    card: require('../../assets/activity-art/picnic_card.jpg'),
    hero: require('../../assets/activity-art/picnic_hero.jpg'),
  },
  breakfast_meetup: {
    thumb: require('../../assets/activity-art/breakfast_meetup_thumb.jpg'),
    card: require('../../assets/activity-art/breakfast_meetup_card.jpg'),
    hero: require('../../assets/activity-art/breakfast_meetup_hero.jpg'),
  },
  lunch_meetup: {
    thumb: require('../../assets/activity-art/lunch_meetup_thumb.jpg'),
    card: require('../../assets/activity-art/lunch_meetup_card.jpg'),
    hero: require('../../assets/activity-art/lunch_meetup_hero.jpg'),
  },
  beach: {
    thumb: require('../../assets/activity-art/beach_thumb.jpg'),
    card: require('../../assets/activity-art/beach_card.jpg'),
    hero: require('../../assets/activity-art/beach_hero.jpg'),
  },
  indoor_playground: {
    thumb: require('../../assets/activity-art/indoor_playground_thumb.jpg'),
    card: require('../../assets/activity-art/indoor_playground_card.jpg'),
    hero: require('../../assets/activity-art/indoor_playground_hero.jpg'),
  },
  story_time: {
    thumb: require('../../assets/activity-art/story_time_thumb.jpg'),
    card: require('../../assets/activity-art/story_time_card.jpg'),
    hero: require('../../assets/activity-art/story_time_hero.jpg'),
  },
  music_activity: {
    thumb: require('../../assets/activity-art/music_activity_thumb.jpg'),
    card: require('../../assets/activity-art/music_activity_card.jpg'),
    hero: require('../../assets/activity-art/music_activity_hero.jpg'),
  },
  swimming: {
    thumb: require('../../assets/activity-art/swimming_thumb.jpg'),
    card: require('../../assets/activity-art/swimming_card.jpg'),
    hero: require('../../assets/activity-art/swimming_hero.jpg'),
  },
  fitness: {
    thumb: require('../../assets/activity-art/fitness_thumb.jpg'),
    card: require('../../assets/activity-art/fitness_card.jpg'),
    hero: require('../../assets/activity-art/fitness_hero.jpg'),
  },
  yoga: {
    thumb: require('../../assets/activity-art/yoga_thumb.jpg'),
    card: require('../../assets/activity-art/yoga_card.jpg'),
    hero: require('../../assets/activity-art/yoga_hero.jpg'),
  },
  workshop: {
    thumb: require('../../assets/activity-art/workshop_thumb.jpg'),
    card: require('../../assets/activity-art/workshop_card.jpg'),
    hero: require('../../assets/activity-art/workshop_hero.jpg'),
  },
  museum: {
    thumb: require('../../assets/activity-art/museum_thumb.jpg'),
    card: require('../../assets/activity-art/museum_card.jpg'),
    hero: require('../../assets/activity-art/museum_hero.jpg'),
  },
  zoo: {
    thumb: require('../../assets/activity-art/zoo_thumb.jpg'),
    card: require('../../assets/activity-art/zoo_card.jpg'),
    hero: require('../../assets/activity-art/zoo_hero.jpg'),
  },
  shopping_together: {
    thumb: require('../../assets/activity-art/shopping_together_thumb.jpg'),
    card: require('../../assets/activity-art/shopping_together_card.jpg'),
    hero: require('../../assets/activity-art/shopping_together_hero.jpg'),
  },
  moms_night_out: {
    thumb: require('../../assets/activity-art/moms_night_out_thumb.jpg'),
    card: require('../../assets/activity-art/moms_night_out_card.jpg'),
    hero: require('../../assets/activity-art/moms_night_out_hero.jpg'),
  },
  support_circle: {
    thumb: require('../../assets/activity-art/support_circle_thumb.jpg'),
    card: require('../../assets/activity-art/support_circle_card.jpg'),
    hero: require('../../assets/activity-art/support_circle_hero.jpg'),
  },
  other: {
    thumb: require('../../assets/activity-art/other_thumb.jpg'),
    card: require('../../assets/activity-art/other_card.jpg'),
    hero: require('../../assets/activity-art/other_hero.jpg'),
  },
};
