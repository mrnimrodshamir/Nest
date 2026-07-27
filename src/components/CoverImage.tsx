import React from 'react';
import { Image, StyleSheet, StyleProp, ViewStyle, ImageStyle } from 'react-native';
import type { ActivityCategory } from '@/types/activity';
import { CuratedCover, parseCuratedCover } from '@/components/CuratedCover';

interface CoverImageProps {
  url: string | null;
  fallbackCategory: ActivityCategory;
  style?: StyleProp<ViewStyle>;
}

/** Renders whatever cover an activity has: an uploaded photo, a curated
 *  gradient (url starts with "curated:"), or — if somehow neither — the
 *  curated gradient for its category, so a cover is never truly blank. */
export function CoverImage({ url, fallbackCategory, style }: CoverImageProps) {
  const curatedCategory = parseCuratedCover(url);
  if (curatedCategory) return <CuratedCover category={curatedCategory} style={style} />;
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={[styles.fill, style] as StyleProp<ImageStyle>}
        resizeMode="cover"
      />
    );
  }
  return <CuratedCover category={fallbackCategory} style={style} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
