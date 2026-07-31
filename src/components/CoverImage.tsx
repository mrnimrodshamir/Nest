import React from 'react';
import { Image, StyleSheet, StyleProp, ViewStyle, ImageStyle } from 'react-native';
import type { ActivityCategory } from '@/types/activity';
import { parseCuratedCover } from '@/components/CuratedCover';
import { CategoryArtwork } from '@/components/CategoryArtwork';

interface CoverImageProps {
  url: string | null;
  fallbackCategory: ActivityCategory;
  style?: StyleProp<ViewStyle>;
}

/** The one rendering entry point for an activity's cover, used identically
 *  by Discovery cards, Activity Detail, Chats rows, and the Create
 *  Activity preview — so all four surfaces are guaranteed to show the
 *  same image for the same activity. Priority: an uploaded photo always
 *  wins; otherwise the category's automatic artwork renders via
 *  CategoryArtwork (final bundled asset if one exists, else the
 *  temporary hand-authored SVG scene) — never a blank cover. */
export function CoverImage({ url, fallbackCategory, style }: CoverImageProps) {
  const curatedCategory = parseCuratedCover(url);
  if (curatedCategory) return <CategoryArtwork category={curatedCategory} style={style} />;
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={[styles.fill, style] as StyleProp<ImageStyle>}
        resizeMode="cover"
      />
    );
  }
  return <CategoryArtwork category={fallbackCategory} style={style} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
