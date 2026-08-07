import React, { useEffect, useState, type ReactNode } from 'react';
import { InteractionManager, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import type { ContentImageAsset, ContentImageVariantName } from '@/types/contentImage';
import { selectContentImageVariant } from '@/utils/contentImage';

interface ContentImageProps {
  asset?: ContentImageAsset | null;
  legacyUri?: string | null;
  variant: ContentImageVariantName;
  fallback: ReactNode;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  /** Feed virtualization controls viewport mounting; this avoids loading during active gestures. */
  deferUntilInteraction?: boolean;
}

export function ContentImage({ asset = null, legacyUri = null, variant, fallback, style, accessibilityLabel, deferUntilInteraction = true }: ContentImageProps) {
  const selected = selectContentImageVariant(asset, variant);
  // Once a normalized record exists, its rights decision is authoritative.
  // Legacy URLs are used only for rows not yet migrated into the pipeline.
  const uri = asset ? selected?.url ?? null : legacyUri;
  const placeholder = asset?.placeholder ?? undefined;
  const [ready, setReady] = useState(!deferUntilInteraction);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
    if (!deferUntilInteraction) { setReady(true); return; }
    setReady(false);
    const task = InteractionManager.runAfterInteractions(() => setReady(true));
    return () => task.cancel();
  }, [uri, deferUntilInteraction]);

  return <View style={[styles.container, style]}>
    {uri && ready && !failed ? <Image
      source={{ uri }}
      placeholder={placeholder}
      placeholderContentFit="cover"
      contentFit="cover"
      cachePolicy="memory-disk"
      transition={180}
      recyclingKey={`${variant}:${uri}`}
      style={StyleSheet.absoluteFill}
      onError={() => setFailed(true)}
      accessibilityLabel={accessibilityLabel}
      accessibilityIgnoresInvertColors
    /> : <View style={StyleSheet.absoluteFill} pointerEvents="none">{fallback}</View>}
  </View>;
}

const styles = StyleSheet.create({
  /** ROOT CAUSE OF THE OVERSIZED "MUZA" CARD.
   *
   *  The remote <Image> is absolutely filled, so it can never contribute
   *  intrinsic height. The FALLBACK was not — it rendered as a normal flow
   *  child. CategoryArtwork's fallback is a bundled require()d asset whose
   *  intrinsic size is ~1200x900 POINTS, and it asks for height: '100%'.
   *  A percentage height cannot resolve against a parent whose own height is
   *  indefinite (a parent sized only by `minHeight`), so Yoga discarded it
   *  and laid the asset out at intrinsic size — growing the row to ~900pt
   *  while the 112pt-wide image column squeezed the body beside it.
   *
   *  Absolutely filling the fallback too makes this container's height
   *  independent of its CONTENT in every branch, so a source image can never
   *  determine card height regardless of what the caller passes as `style`. */
  container: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
