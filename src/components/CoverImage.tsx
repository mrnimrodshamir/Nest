import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, StyleProp, ViewStyle, ImageStyle } from 'react-native';
import type { ActivityCategory } from '@/types/activity';
import { parseCuratedCover } from '@/components/CuratedCover';
import { CategoryArtwork } from '@/components/CategoryArtwork';
import { decideCoverImageSource } from '@/utils/decideCoverImageSource';
import type { ActivityArtVariant } from '@/constants/activityArtVariant';

interface CoverImageProps {
  url: string | null;
  fallbackCategory: ActivityCategory;
  /** Which of the three purpose-built sizes this container needs — see
   *  activityArtManifest.ts. Threaded straight through to CategoryArtwork. */
  variant: ActivityArtVariant;
  /** Short label identifying the calling screen — purely for the __DEV__
   *  log, no effect on rendering. Threaded through to CategoryArtwork. */
  surface?: string;
  style?: StyleProp<ViewStyle>;
}

/** The one rendering entry point for an activity's cover, used identically
 *  by Discovery cards, Activity Detail, Chats rows, and the Create Activity
 *  preview/review — so all surfaces are guaranteed to show the same image
 *  for the same activity (modulo each surface's own variant size). Priority:
 *  an uploaded photo always wins; if it fails to load, falls back to the
 *  category's automatic artwork rather than a blank space; otherwise the
 *  category's automatic artwork renders via CategoryArtwork (final bundled
 *  asset if one exists for this variant, else a placeholder) — never a
 *  blank cover. */
export function CoverImage({ url, fallbackCategory, variant, surface, style }: CoverImageProps) {
  const [uploadFailed, setUploadFailed] = useState(false);

  // A new url (e.g. the host picked a different photo after a previous one
  // failed to load) deserves a fresh attempt, not a stale failure flag.
  useEffect(() => {
    setUploadFailed(false);
  }, [url]);

  const curatedCategory = parseCuratedCover(url);
  const source = decideCoverImageSource({
    url,
    isCuratedUrl: Boolean(curatedCategory),
    uploadFailed,
  });

  if (source === 'curated-placeholder' && curatedCategory) {
    return <CategoryArtwork category={curatedCategory} variant={variant} surface={surface} style={style} />;
  }

  if (source === 'uploaded-photo' && url) {
    if (__DEV__) {
      console.log(`[ActivityArt] ${surface ? `${surface} ` : ''}variant=${variant} -> uploaded-photo`);
    }
    return (
      <Image
        source={{ uri: url }}
        style={[styles.fill, style] as StyleProp<ImageStyle>}
        resizeMode="cover"
        onError={() => setUploadFailed(true)}
      />
    );
  }

  return <CategoryArtwork category={fallbackCategory} variant={variant} surface={surface} style={style} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
});
