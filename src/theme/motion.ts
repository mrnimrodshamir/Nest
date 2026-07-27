/**
 * Momzi motion tokens
 *
 * Use with react-native-reanimated's withSpring / withTiming. iOS-native
 * feel comes from spring physics, not linear easing curves — almost every
 * transition in Momzi should be a spring, not a duration-based tween.
 *
 * Usage:
 *   import { withSpring } from 'react-native-reanimated';
 *   import { springs } from '@/theme/motion';
 *   scale.value = withSpring(1, springs.snappy);
 */

export const springs = {
  // Screen transitions, sheet presentations — soft, unhurried
  gentle: { damping: 18, stiffness: 120, mass: 1 },
  // Button presses, toggles, chip selection — quick, decisive
  snappy: { damping: 20, stiffness: 220, mass: 0.9 },
  // Card entrances, list item stagger — slight overshoot for delight
  playful: { damping: 12, stiffness: 160, mass: 1 },
} as const;

export const durations = {
  fast: 150,
  base: 250,
  slow: 400,
} as const;

// Standard interaction feedback — apply to every pressable in the app
export const pressFeedback = {
  scale: 0.96,
  spring: springs.snappy,
} as const;

// Stagger delay (ms) between list items animating in — e.g. Discover feed
export const listStagger = 40;
