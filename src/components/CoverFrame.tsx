import React, { useState } from 'react';
import { View, StyleSheet, useWindowDimensions, StyleProp, ViewStyle } from 'react-native';
import type { ActivityArtVariant } from '@/constants/activityArtVariant';
import { resolveFrameRenderedHeight } from '@/constants/activityArtFrame';

interface CoverFrameProps {
  variant: ActivityArtVariant;
  /** Corner rounding; frames always clip so a cover can never bleed past. */
  radius?: number;
  /** Layout-only style (width, margins, background). Never height — the
   *  frame owns its own height so an image can't drive screen height. */
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

/** The single aspect-ratio wrapper for activity artwork. Every surface
 *  renders its cover inside one of these instead of hand-rolling an
 *  `aspectRatio` + `overflow` container, which is how Discovery, Chats,
 *  Detail and the Create/Review previews previously drifted apart.
 *
 *  The frame — not the image — determines size:
 *    - width comes from the parent (usually '100%' or a fixed thumb width)
 *    - height comes from the variant's aspect ratio
 *    - hero additionally gets a max-height cap so it stays a contained
 *      section above the details rather than dominating small screens
 *  The child image is absolutely filled, so it can never contribute
 *  intrinsic height and can never stretch — `cover` trims instead. */
export function CoverFrame({ variant, radius = 0, style, children }: CoverFrameProps) {
  const { width: windowWidth, height: screenHeight } = useWindowDimensions();
  const [measuredWidth, setMeasuredWidth] = useState<number | null>(null);

  // Height is resolved to a NUMBER rather than expressed as aspectRatio +
  // maxHeight. That combination looks equivalent but is not: when Yoga has a
  // definite width and an aspectRatio, clamping the height with maxHeight makes
  // it RE-DERIVE the width from the clamped height. The frame silently narrowed
  // to `cap * aspect` and the media rendered as a left-aligned letterbox with a
  // gutter down the right of the card -- the "broken image" seen on device. A
  // numeric height leaves `width: '100%'` untouched, and `cover` trims the
  // overflow exactly as intended.
  const width = measuredWidth ?? windowWidth;
  const height = resolveFrameRenderedHeight(variant, width, screenHeight);

  return (
    <View
      onLayout={(event) => {
        const next = event.nativeEvent.layout.width;
        // Guard the set: onLayout fires on every re-layout, and writing an
        // unchanged value would loop.
        setMeasuredWidth((current) => (current !== null && Math.abs(current - next) < 1 ? current : next));
      }}
      style={[styles.frame, { height, borderRadius: radius }, style]}
    >
      <View style={StyleSheet.absoluteFill}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  // overflow hidden is non-negotiable: it is what guarantees a `cover`
  // image is clipped to the frame instead of painting outside it.
  frame: { overflow: 'hidden', width: '100%' },
});
