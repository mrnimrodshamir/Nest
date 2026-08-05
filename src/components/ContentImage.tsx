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
  const uri = selected?.url ?? legacyUri;
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
    /> : fallback}
  </View>;
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
});
