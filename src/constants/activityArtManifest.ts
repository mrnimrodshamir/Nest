import type { ActivityCategory } from '@/types/activity';

/** Spec every final activity-art asset must meet. One master image per
 *  category, landscape enough to crop cleanly at every size it's shown
 *  at — full-width Activity Detail hero (~16:9), Discovery/Create-Activity
 *  card hero (~wide), and the square Chats thumbnail (center-cropped via
 *  resizeMode: "cover"). A single 4:3 source covers all of them without
 *  needing per-surface crops. */
export const ACTIVITY_ART_SPEC = {
  width: 1200,
  height: 900,
  aspectRatio: '4:3' as const,
  format: 'jpg' as const,
  maxFileSizeKB: 220,
  colorSpace: 'sRGB' as const,
};

export interface ActivityArtManifestEntry {
  category: ActivityCategory;
  /** Exact filename expected at assets/activity-art/<filename> once the
   *  real asset is supplied — see ACTIVITY_ART_SPEC for dimensions. */
  filename: string;
  /** Flips to true only once the file exists AND a matching require() is
   *  added to activityArtAssets.ts — see that file's header comment. */
  hasArt: boolean;
}

/** The complete 21-category manifest. All 21 final assets are installed —
 *  every category now renders its real image via CategoryArtwork.tsx; none
 *  fall back to the hand-authored SVG scene in CuratedCover.tsx anymore. */
export const ACTIVITY_ART_MANIFEST: ActivityArtManifestEntry[] = [
  { category: 'stroller_walk', filename: 'stroller_walk.jpg', hasArt: true },
  { category: 'coffee_meetup', filename: 'coffee_meetup.jpg', hasArt: true },
  { category: 'baby_playtime', filename: 'baby_playtime.jpg', hasArt: true },
  { category: 'playground_meetup', filename: 'playground_meetup.jpg', hasArt: true },
  { category: 'picnic', filename: 'picnic.jpg', hasArt: true },
  { category: 'breakfast_meetup', filename: 'breakfast_meetup.jpg', hasArt: true },
  { category: 'lunch_meetup', filename: 'lunch_meetup.jpg', hasArt: true },
  { category: 'beach', filename: 'beach.jpg', hasArt: true },
  { category: 'indoor_playground', filename: 'indoor_playground.jpg', hasArt: true },
  { category: 'story_time', filename: 'story_time.jpg', hasArt: true },
  { category: 'music_activity', filename: 'music_activity.jpg', hasArt: true },
  { category: 'swimming', filename: 'swimming.jpg', hasArt: true },
  { category: 'fitness', filename: 'fitness.jpg', hasArt: true },
  { category: 'yoga', filename: 'yoga.jpg', hasArt: true },
  { category: 'workshop', filename: 'workshop.jpg', hasArt: true },
  { category: 'museum', filename: 'museum.jpg', hasArt: true },
  { category: 'zoo', filename: 'zoo.jpg', hasArt: true },
  { category: 'shopping_together', filename: 'shopping_together.jpg', hasArt: true },
  { category: 'moms_night_out', filename: 'moms_night_out.jpg', hasArt: true },
  { category: 'support_circle', filename: 'support_circle.jpg', hasArt: true },
  { category: 'other', filename: 'other.jpg', hasArt: true },
];
