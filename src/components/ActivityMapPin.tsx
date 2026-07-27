import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, useReducedMotion } from 'react-native-reanimated';
import { Marker } from 'react-native-maps';
import { theme, springs } from '@/theme';
import type { Activity } from '@/types/activity';
import { CATEGORY_PIN_COLOR } from '@/types/activity';

interface ActivityMapPinProps {
  activity: Activity;
  selected: boolean;
  onPress: (activity: Activity) => void;
}

export function ActivityMapPin({ activity, selected, onPress }: ActivityMapPinProps) {
  const color = CATEGORY_PIN_COLOR[activity.category];
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = reducedMotion ? (selected ? 1.4 : 1) : withSpring(selected ? 1.4 : 1, springs.snappy);
  }, [selected, reducedMotion, scale]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Marker
      coordinate={{ latitude: activity.latitude, longitude: activity.longitude }}
      onPress={() => onPress(activity)}
      // tracksViewChanges only during the selection transition — leaving
      // this permanently true tanks map performance with many pins
      tracksViewChanges={selected}
    >
      <Animated.View
        style={[styles.pin, { backgroundColor: color }, selected && styles.pinSelected, animatedStyle]}
      />
    </Marker>
  );
}

const styles = StyleSheet.create({
  pin: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: theme.background.surface,
  },
  pinSelected: {
    borderWidth: 3,
  },
});

/**
 * TODO: at scale, dense areas need clustering (react-native-map-clustering
 * or a supercluster-based custom layer) rather than one Marker per activity —
 * out of scope for MVP density, revisit once a market gets crowded.
 */
