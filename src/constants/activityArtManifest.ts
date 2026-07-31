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

/** The complete 21-category manifest. `other` doubles as the fallback for
 *  any category (present or future) that doesn't have its own asset yet —
 *  every category currently falls back to the hand-authored SVG scene in
 *  CuratedCover.tsx (see CategoryArtwork.tsx), NOT to the `other` image,
 *  until real files land. */
export const ACTIVITY_ART_MANIFEST: ActivityArtManifestEntry[] = [
  { category: 'stroller_walk', filename: 'stroller_walk.jpg', hasArt: false },
  { category: 'coffee_meetup', filename: 'coffee_meetup.jpg', hasArt: false },
  { category: 'baby_playtime', filename: 'baby_playtime.jpg', hasArt: false },
  { category: 'playground_meetup', filename: 'playground_meetup.jpg', hasArt: false },
  { category: 'picnic', filename: 'picnic.jpg', hasArt: false },
  { category: 'breakfast_meetup', filename: 'breakfast_meetup.jpg', hasArt: false },
  { category: 'lunch_meetup', filename: 'lunch_meetup.jpg', hasArt: false },
  { category: 'beach', filename: 'beach.jpg', hasArt: false },
  { category: 'indoor_playground', filename: 'indoor_playground.jpg', hasArt: false },
  { category: 'story_time', filename: 'story_time.jpg', hasArt: false },
  { category: 'music_activity', filename: 'music_activity.jpg', hasArt: false },
  { category: 'swimming', filename: 'swimming.jpg', hasArt: false },
  { category: 'fitness', filename: 'fitness.jpg', hasArt: false },
  { category: 'yoga', filename: 'yoga.jpg', hasArt: false },
  { category: 'workshop', filename: 'workshop.jpg', hasArt: false },
  { category: 'museum', filename: 'museum.jpg', hasArt: false },
  { category: 'zoo', filename: 'zoo.jpg', hasArt: false },
  { category: 'shopping_together', filename: 'shopping_together.jpg', hasArt: false },
  { category: 'moms_night_out', filename: 'moms_night_out.jpg', hasArt: false },
  { category: 'support_circle', filename: 'support_circle.jpg', hasArt: false },
  { category: 'other', filename: 'other.jpg', hasArt: false },
];
