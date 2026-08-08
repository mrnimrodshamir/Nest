import type { ActivityArtVariant } from './activityArtVariant';

/** The ONE definition of how much space a cover is allowed to occupy, per
 *  variant. Every surface that renders activity artwork sizes its frame
 *  from here (via CoverFrame) rather than declaring its own aspectRatio, so
 *  a card can never accidentally be given hero proportions again.
 *
 *  These intentionally mirror the source art's own ratios (see
 *  activityArtManifest.ts) so `resizeMode: "cover"` is a no-op fit rather
 *  than a crop:
 *    thumb 600x450  -> 4:3
 *    card  1600x900 -> 16:9
 *    hero  1200x900 -> 4:3 */
export const ACTIVITY_ART_ASPECT: Record<ActivityArtVariant, number> = {
  thumb: 4 / 3,
  card: 16 / 9,
  hero: 4 / 3,
};

/** The single height ceiling for CARD media, in points.
 *
 *  Why a fixed value rather than a screen fraction: a feed card should look
 *  the same on every phone, and the problem being solved is comparability
 *  BETWEEN card types, not fit on one device.
 *
 *  168 is deliberately PlaceCard's existing `maxHeight`. Before this, an
 *  ActivityCard's 16:9 image at full content width (~343pt on a 375pt screen)
 *  rendered ~193pt of media, so the whole card ran ~290pt while a Place or
 *  Event row was 116-168pt — one activity consumed the screen and the mixed
 *  feed became impossible to scan. Binding all three to the same ceiling makes
 *  a screenful show several cards while each type keeps its own shape:
 *  Activities stay a wide image above text, Places and Events stay rows. */
export const CARD_MEDIA_MAX_HEIGHT = 168;

/** Fraction of the shorter screen dimension a hero is allowed to consume.
 *  A 4:3 hero at full content width is ~75% of the width in height, which
 *  on a 375pt-wide iPhone SE pushed the title, meta and join CTA below the
 *  fold. Capping the height keeps the aspect ratio intact for the frame
 *  while guaranteeing the details section stays visible without scrolling.
 *  `cover` absorbs the difference by trimming top/bottom, never stretching. */
export const HERO_MAX_HEIGHT_RATIO = 0.32;

/** Resolve the concrete max height (in points) a hero frame may occupy on a
 *  given screen. Pure so it can be asserted across device sizes in tests. */
export function resolveHeroMaxHeight(screenHeight: number): number {
  return Math.round(screenHeight * HERO_MAX_HEIGHT_RATIO);
}

/** The height a frame of `width` would naturally take for a variant, before
 *  any max-height cap is applied. Pure, for tests and for reasoning about
 *  small-screen layout. */
export function resolveFrameHeight(variant: ActivityArtVariant, width: number): number {
  return width / ACTIVITY_ART_ASPECT[variant];
}

/** The height a hero actually renders at on a given screen — the natural
 *  aspect-ratio height, clamped by the cap. */
export function resolveHeroRenderedHeight(width: number, screenHeight: number): number {
  return Math.min(resolveFrameHeight('hero', width), resolveHeroMaxHeight(screenHeight));
}

/** The height card media actually renders at — natural aspect height, clamped
 *  by the shared card ceiling. `cover` absorbs the difference by trimming, so
 *  the image is never stretched. */
export function resolveCardRenderedHeight(width: number): number {
  return Math.min(resolveFrameHeight('card', width), CARD_MEDIA_MAX_HEIGHT);
}
