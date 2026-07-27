import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import { theme } from '@/theme';
import type { Activity } from '@/types/activity';
import { CATEGORY_PIN_COLOR } from '@/types/activity';

interface ActivityMapPinProps {
  activity: Activity;
  selected: boolean;
  onPress: (activity: Activity) => void;
}

export function ActivityMapPin({ activity, selected, onPress }: ActivityMapPinProps) {
  const color = CATEGORY_PIN_COLOR[activity.category];

  return (
    <Marker
      coordinate={{ latitude: activity.latitude, longitude: activity.longitude }}
      onPress={() => onPress(activity)}
      // tracksViewChanges only during the brief selection transition —
      // leaving this permanently true tanks map performance with many pins
      tracksViewChanges={selected}
    >
      <View
        style={[
          styles.pin,
          { backgroundColor: color },
          selected && styles.pinSelected,
        ]}
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
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 3,
  },
});

/**
 * TODO: at scale, dense areas need clustering (react-native-map-clustering
 * or a supercluster-based custom layer) rather than one Marker per activity —
 * out of scope for MVP density, revisit once a market gets crowded.
 */
