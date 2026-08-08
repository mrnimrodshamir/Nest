import React from 'react';
import { View, StyleSheet, useWindowDimensions, StyleProp, ViewStyle } from 'react-native';
import type { ActivityArtVariant } from '@/constants/activityArtVariant';
import { ACTIVITY_ART_ASPECT, CARD_MEDIA_MAX_HEIGHT, resolveHeroMaxHeight } from '@/constants/activityArtFrame';

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
  const { height: screenHeight } = useWindowDimensions();

  return (
    <View
      style={[
        styles.frame,
        { aspectRatio: ACTIVITY_ART_ASPECT[variant], borderRadius: radius },
        variant === 'hero' && { maxHeight: resolveHeroMaxHeight(screenHeight) },
        // Card media is capped at the same ceiling as a Place/Event row, so a
        // mixed feed shows several comparable cards rather than one tall
        // Activity pushing everything else below the fold.
        variant === 'card' && { maxHeight: CARD_MEDIA_MAX_HEIGHT },
        style,
      ]}
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
