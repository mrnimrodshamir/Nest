import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';
import { theme, spacing, radius } from '@/theme';

/** Loading placeholder for a feed card — shown only on the true first load
 *  (never on pull-to-refresh of already-visible data, which has its own
 *  native spinner). Pulses gently; reduced motion shows a static tint
 *  instead of looping opacity. */
export function SkeletonCard() {
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion) return;
    opacity.value = withRepeat(
      withSequence(withTiming(0.5, { duration: 700 }), withTiming(1, { duration: 700 })),
      -1,
      true,
    );
  }, [reducedMotion, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: reducedMotion ? 0.7 : opacity.value }));

  return (
    <Animated.View style={[styles.card, animatedStyle]}>
      <View style={styles.image} />
      <View style={styles.body}>
        <View style={styles.pill} />
        <View style={styles.titleLine} />
        <View style={styles.metaLine} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.background.surface,
    borderRadius: radius.xl,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border.default,
    overflow: 'hidden',
    marginBottom: spacing.md,
  },
  image: { height: 130, backgroundColor: theme.background.app },
  body: { padding: spacing.md, gap: spacing.sm },
  pill: { width: 72, height: 18, borderRadius: radius.pill, backgroundColor: theme.background.app },
  titleLine: { width: '70%', height: 16, borderRadius: 4, backgroundColor: theme.background.app },
  metaLine: { width: '45%', height: 13, borderRadius: 4, backgroundColor: theme.background.app },
});
