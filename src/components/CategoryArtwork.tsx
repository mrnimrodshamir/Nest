import React from 'react';
import { Image, StyleSheet, StyleProp, ViewStyle, ImageStyle } from 'react-native';
import type { ActivityCategory } from '@/types/activity';
import { ACTIVITY_ART_ASSETS } from '@/constants/activityArtAssets';
import { CuratedCover } from '@/components/CuratedCover';

interface CategoryArtworkProps {
  category: ActivityCategory;
  style?: StyleProp<ViewStyle>;
}

/** The single automatic-artwork surface for a category — every screen that
 *  shows a category's default cover (Discovery cards, Activity Detail,
 *  Chats rows, Create Activity preview) renders through here via
 *  CoverImage, so there is exactly one place that decides "final asset or
 *  temporary fallback."
 *
 *  Final assets are local, bundled files (see activityArtAssets.ts) —
 *  bundled means they're resolved at build time, so there's no network
 *  fetch and no loading flicker/layout shift once a category has one.
 *  Until a category's file is supplied, this renders the hand-authored
 *  SVG scene from CuratedCover.tsx as an explicit TEMPORARY fallback —
 *  never an emoji, never a generic flat placeholder. */
export function CategoryArtwork({ category, style }: CategoryArtworkProps) {
  const finalAsset = ACTIVITY_ART_ASSETS[category];
  if (finalAsset) {
    return (
      <Image
        source={finalAsset}
        style={[styles.fill, style] as StyleProp<ImageStyle>}
        resizeMode="cover"
      />
    );
  }
  return <CuratedCover category={category} style={style} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
