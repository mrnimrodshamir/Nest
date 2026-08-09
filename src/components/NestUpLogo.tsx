import React from 'react';
import { Image, StyleSheet, View } from 'react-native';

/**
 * The NestUp brand mark, shown on the Launch and Welcome screens.
 *
 * This is the same artwork as the app icon (assets/brand/nestup-mark.png is
 * generated from the master logo by scripts/build_brand_icons.py), rendered as
 * a rounded badge so the first screen and the home-screen icon read as one
 * thing. Regenerate that script rather than editing the PNG by hand.
 *
 * It is deliberately a plain Image with no animation. The former animated
 * variant, built on react-native-reanimated, was the source of a native SIGABRT
 * (RNWorklets::AnimationFrameBatchinator::flush() -> Hermes throwPendingError)
 * when App.tsx's reactive routing unmounted the screen mid-animation. Nothing
 * on a screen that can be unmounted by the session transition may animate.
 */
export function NestUpLogo({ size = 96 }: { size?: number }) {
  return (
    <View style={[styles.frame, { width: size, height: size, borderRadius: size * 0.22 }]}>
      <Image
        source={require('../../assets/brand/nestup-mark.png')}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        accessibilityRole="image"
        accessibilityLabel="NestUp"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  // The mark is full-bleed to its own edges, so the badge must clip it.
  frame: { overflow: 'hidden' },
});
