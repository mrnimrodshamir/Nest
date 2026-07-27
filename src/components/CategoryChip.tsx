import React, { useEffect } from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, useReducedMotion } from 'react-native-reanimated';
import { theme, typography, spacing, radius, springs } from '@/theme';

interface CategoryChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function CategoryChip({ label, selected, onPress }: CategoryChipProps) {
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    if (reducedMotion) return;
    // A quick pop on selection change reads as confirmation without being
    // distracting on every render.
    scale.value = withSpring(1.06, springs.snappy, () => {
      scale.value = withSpring(1, springs.snappy);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected]);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected, animatedStyle]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>
        {label}
      </Text>
    </AnimatedPressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: theme.background.app,
    marginRight: spacing.sm,
  },
  chipSelected: {
    backgroundColor: theme.brand.primary,
  },
  label: {
    ...typography.subhead,
    fontWeight: '500' as const,
    color: theme.text.primary,
  },
  labelSelected: {
    color: theme.text.inverse,
    fontWeight: '600' as const,
  },
});
