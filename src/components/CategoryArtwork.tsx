import React from 'react';
import { Image, StyleSheet, StyleProp, ViewStyle, ImageStyle } from 'react-native';
import type { ActivityCategory } from '@/types/activity';
import { ACTIVITY_ART_ASSETS } from '@/constants/activityArtAssets';
import { resolveActivityArt } from '@/utils/resolveActivityArt';
import type { ActivityArtVariant } from '@/constants/activityArtVariant';
import { CuratedCover } from '@/components/CuratedCover';

interface CategoryArtworkProps {
  category: ActivityCategory;
  /** Which of the three purpose-built sizes to render — see
   *  activityArtManifest.ts. Required, not defaulted: every call site must
   *  consciously pick the variant that matches its own container, since a
   *  wrong variant means a wrongly-shaped crop. */
  variant: ActivityArtVariant;
  style?: StyleProp<ViewStyle>;
}

/** The single automatic-artwork surface for a category+variant — every
 *  screen that shows a category's default cover (Discovery cards, Activity
 *  Detail, Chats rows, Create Activity preview/review) renders through here
 *  via CoverImage, so there is exactly one place that decides "final asset,
 *  other-category fallback, or temporary placeholder scene."
 *
 *  Final assets are local, bundled files (see activityArtAssets.ts) —
 *  bundled means they're resolved at build time, so there's no network
 *  fetch and no loading flicker/layout shift once a category+variant has
 *  one. Resolution never substitutes a different aspect ratio: a missing
 *  thumb falls back to the "other" category's thumb, never to a card or
 *  hero image forced into a thumb-shaped box. See resolveActivityArt.ts. */
export function CategoryArtwork({ category, variant, style }: CategoryArtworkProps) {
  const resolved = resolveActivityArt(category, variant, ACTIVITY_ART_ASSETS);

  if (__DEV__ && resolved.warning) {
    console.warn(`[ActivityArt] ${resolved.warning}`);
  }

  if (resolved.kind === 'photo' && resolved.resolvedCategory) {
    const source = ACTIVITY_ART_ASSETS[resolved.resolvedCategory]?.[variant];
    if (source) {
      return (
        <Image
          source={source}
          style={[styles.fill, style] as StyleProp<ImageStyle>}
          resizeMode="cover"
        />
      );
    }
  }

  return <CuratedCover category={category} style={style} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
