import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  useReducedMotion,
} from 'react-native-reanimated';

/**
 * Real Momzi brand paths (from assets/brand/momzi-logo-master.svg, viewBox
 * 0 0 1024 1024). Split left/right so the two halves can animate in from
 * opposite sides independently — this is the only place that needs to
 * change if the artwork itself changes.
 */
const COLORS = {
  leftBody: '#F28C86',
  leftBlanket: '#F7B1AA',
  rightBody: '#A894D6',
  rightBlanket: '#C8BCEB',
};

function LeftHalf({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      <Circle cx={356} cy={188} r={66} fill={COLORS.leftBody} />
      <Circle cx={429} cy={323} r={54} fill={COLORS.leftBlanket} />
      <Path
        fill={COLORS.leftBody}
        d="M 252 812 C 172 705, 150 577, 174 438 C 194 323, 242 255, 312 223 C 319 268, 343 300, 379 317 C 339 343, 310 389, 296 451 C 276 542, 286 649, 327 749 C 344 791, 369 831, 402 870 L 314 870 C 291 852, 271 833, 252 812 Z"
      />
      <Path
        fill={COLORS.leftBody}
        d="M 300 470 C 326 398, 369 347, 425 321 C 460 305, 503 305, 536 326 C 566 345, 582 376, 580 410 C 578 444, 561 479, 527 516 C 492 554, 451 588, 418 621 C 389 650, 365 680, 350 713 C 328 660, 318 601, 321 544 C 323 516, 316 492, 300 470 Z"
      />
      <Path
        fill={COLORS.leftBlanket}
        d="M 404 374 C 432 348, 471 337, 506 346 C 540 355, 565 380, 570 412 C 575 448, 557 484, 525 521 C 494 557, 458 588, 430 616 C 406 640, 386 664, 371 690 C 362 633, 367 577, 385 528 C 401 485, 411 446, 404 374 Z"
      />
    </Svg>
  );
}

function RightHalf({ size }: { size: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 1024 1024">
      <Circle cx={668} cy={188} r={66} fill={COLORS.rightBody} />
      <Circle cx={595} cy={323} r={54} fill={COLORS.rightBlanket} />
      <Path
        fill={COLORS.rightBody}
        d="M 772 812 C 852 705, 874 577, 850 438 C 830 323, 782 255, 712 223 C 705 268, 681 300, 645 317 C 685 343, 714 389, 728 451 C 748 542, 738 649, 697 749 C 680 791, 655 831, 622 870 L 710 870 C 733 852, 753 833, 772 812 Z"
      />
      <Path
        fill={COLORS.rightBody}
        d="M 724 470 C 698 398, 655 347, 599 321 C 564 305, 521 305, 488 326 C 458 345, 442 376, 444 410 C 446 444, 463 479, 497 516 C 532 554, 573 588, 606 621 C 635 650, 659 680, 674 713 C 696 660, 706 601, 703 544 C 701 516, 708 492, 724 470 Z"
      />
      <Path
        fill={COLORS.rightBlanket}
        d="M 620 374 C 592 348, 553 337, 518 346 C 484 355, 459 380, 454 412 C 449 448, 467 484, 499 521 C 530 557, 566 588, 594 616 C 618 640, 638 664, 653 690 C 662 633, 657 577, 639 528 C 623 485, 613 446, 620 374 Z"
      />
    </Svg>
  );
}

/** Static logo — for headers, welcome screen, anywhere the entrance
 *  animation shouldn't replay. */
export function MomziLogo({ size = 96 }: { size?: number }) {
  return (
    <View style={{ width: size, height: size }}>
      <View style={StyleSheet.absoluteFill}>
        <LeftHalf size={size} />
      </View>
      <View style={StyleSheet.absoluteFill}>
        <RightHalf size={size} />
      </View>
    </View>
  );
}

interface AnimatedMomziLogoProps {
  size?: number;
  /** Called once the entrance settle animation finishes (or immediately,
   *  under reduced motion). Screens should never delay routing waiting on
   *  this — it's for optional idle-state chaining, not a gate. */
  onSettled?: () => void;
}

/** Entrance animation: left mother+baby slide in from the left, right from
 *  the right, both settle into place with a soft spring. Respects
 *  Reduce Motion by cross-fading instead of sliding. */
export function AnimatedMomziLogo({ size = 140, onSettled }: AnimatedMomziLogoProps) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) {
      progress.value = withTiming(1, { duration: 350 }, (finished) => {
        if (finished && onSettled) runOnJSSafe(onSettled);
      });
    } else {
      progress.value = withSpring(
        1,
        { damping: 14, stiffness: 120, mass: 0.9 },
        (finished) => {
          if (finished && onSettled) runOnJSSafe(onSettled);
        },
      );
    }
    // Intentionally runs once on mount only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const slideDistance = size * 0.6;

  const leftStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateX: reducedMotion ? 0 : (1 - progress.value) * -slideDistance }],
  }));

  const rightStyle = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateX: reducedMotion ? 0 : (1 - progress.value) * slideDistance }],
  }));

  return (
    <View style={{ width: size, height: size }}>
      <Animated.View style={[StyleSheet.absoluteFill, leftStyle]}>
        <LeftHalf size={size} />
      </Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, rightStyle]}>
        <RightHalf size={size} />
      </Animated.View>
    </View>
  );
}

// Reanimated worklets can't call arbitrary JS directly by default in this
// setup without the babel plugin's auto-workletization handling callbacks —
// withSpring/withTiming callbacks already run on the JS thread in
// react-native-reanimated 3, so this is a plain passthrough for clarity.
function runOnJSSafe(fn: () => void) {
  fn();
}
