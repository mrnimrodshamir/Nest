import type { ActivityCategory } from '@/types/activity';
import type { ActivityArtVariant } from './activityArtVariant';

/** Spec each variant's final asset must meet — three distinct purposes, not
 *  one master image cropped three ways:
 *  - thumb: the small selector/list thumbnail (CategoryPicker, Chats row).
 *    Needs a bold, simple composition — it renders as small as ~48-76pt.
 *  - card: the Discovery feed card banner. Native 16:9, not a crop of a
 *    4:3 source, so nothing is trimmed off the top/bottom at render time.
 *  - hero: the large, detailed view (Create Activity preview/review,
 *    Activity Detail cover). The only variant that tolerates fine detail. */
export const ACTIVITY_ART_VARIANT_SPEC: Record<
  ActivityArtVariant,
  { width: number; height: number; aspectRatio: string; maxFileSizeKB: number }
> = {
  thumb: { width: 600, height: 450, aspectRatio: '4:3', maxFileSizeKB: 60 },
  card: { width: 1600, height: 900, aspectRatio: '16:9', maxFileSizeKB: 150 },
  hero: { width: 1200, height: 900, aspectRatio: '4:3', maxFileSizeKB: 220 },
};

export const ACTIVITY_ART_FORMAT = 'jpg' as const;
export const ACTIVITY_ART_COLOR_SPACE = 'sRGB' as const;

export interface ActivityArtVariantEntry {
  /** Exact filename expected at assets/activity-art/<filename> — see
   *  ACTIVITY_ART_VARIANT_SPEC for the dimensions/budget it must meet. */
  filename: string;
}

/** One entry per variant, exhaustive — a category entry missing `thumb`,
 *  `card`, or `hero` is a TypeScript error, not a runtime surprise. */
export type ActivityArtCategoryEntry = Record<ActivityArtVariant, ActivityArtVariantEntry>;

function entryFor(category: string): ActivityArtCategoryEntry {
  return {
    thumb: { filename: `${category}_thumb.jpg` },
    card: { filename: `${category}_card.jpg` },
    hero: { filename: `${category}_hero.jpg` },
  };
}

/** The complete manifest — every ActivityCategory key is required by the
 *  `Record<ActivityCategory, ...>` annotation below, so omitting a category
 *  (or a future category added to the DB enum but not here) fails `tsc`
 *  immediately rather than silently rendering nothing for it. This is the
 *  canonical "expected 63 files" checklist: 21 categories x 3 variants. */
export const ACTIVITY_ART_MANIFEST: Record<ActivityCategory, ActivityArtCategoryEntry> = {
  stroller_walk: entryFor('stroller_walk'),
  coffee_meetup: entryFor('coffee_meetup'),
  baby_playtime: entryFor('baby_playtime'),
  playground_meetup: entryFor('playground_meetup'),
  picnic: entryFor('picnic'),
  breakfast_meetup: entryFor('breakfast_meetup'),
  lunch_meetup: entryFor('lunch_meetup'),
  beach: entryFor('beach'),
  indoor_playground: entryFor('indoor_playground'),
  story_time: entryFor('story_time'),
  music_activity: entryFor('music_activity'),
  swimming: entryFor('swimming'),
  fitness: entryFor('fitness'),
  yoga: entryFor('yoga'),
  workshop: entryFor('workshop'),
  museum: entryFor('museum'),
  zoo: entryFor('zoo'),
  shopping_together: entryFor('shopping_together'),
  moms_night_out: entryFor('moms_night_out'),
  support_circle: entryFor('support_circle'),
  other: entryFor('other'),
};
