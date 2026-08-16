import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Marker } from 'react-native-maps';
import {
  PersonSimpleWalk,
  Coffee,
  Baby,
  Basket,
  Barbell,
  PersonSimpleTaiChi,
  PaintBrush,
  Sparkle,
  Park,
  Sun,
  ForkKnife,
  Umbrella,
  House,
  BookOpenText,
  MusicNotes,
  SwimmingPool,
  Buildings,
  PawPrint,
  ShoppingBagOpen,
  Martini,
  HandsPraying,
} from 'phosphor-react-native';
import { theme } from '@/theme';
import type { Activity, ActivityCategory } from '@/types/activity';
import { CATEGORY_PIN_COLOR } from '@/types/activity';

interface ActivityMapPinProps {
  activity: Activity;
  selected: boolean;
  onPress: (activity: Activity) => void;
}

export const CATEGORY_ICON: Record<ActivityCategory, React.ComponentType<{ size: number; color: string; weight?: 'fill' | 'bold' }>> = {
  stroller_walk: PersonSimpleWalk,
  coffee_meetup: Coffee,
  baby_playtime: Baby,
  playground_meetup: Park,
  picnic: Basket,
  breakfast_meetup: Sun,
  lunch_meetup: ForkKnife,
  beach: Umbrella,
  indoor_playground: House,
  story_time: BookOpenText,
  music_activity: MusicNotes,
  swimming: SwimmingPool,
  fitness: Barbell,
  yoga: PersonSimpleTaiChi,
  workshop: PaintBrush,
  museum: Buildings,
  zoo: PawPrint,
  shopping_together: ShoppingBagOpen,
  moms_night_out: Martini,
  support_circle: HandsPraying,
  other: Sparkle,
};

/** A compact category-symbol marker — communicates activity type at a
 *  glance, without a tap. No Reanimated: selection state is a plain style
 *  swap, not a shared-value-driven scale, since markers re-render on every
 *  native map region/layout change and that's exactly the interaction
 *  class that caused this session's other Reanimated-related crashes. */
export function ActivityMapPin({ activity, selected, onPress }: ActivityMapPinProps) {
  // Falls back to 'other' for any category value not in these maps (a
  // future category added to the DB enum before this file catches up) —
  // never renders an undefined icon component, which would crash.
  const color = CATEGORY_PIN_COLOR[activity.category] ?? CATEGORY_PIN_COLOR.other;
  const Icon = CATEGORY_ICON[activity.category] ?? CATEGORY_ICON.other;

  return (
    <Marker
      coordinate={{ latitude: activity.latitude, longitude: activity.longitude }}
      onPress={() => onPress(activity)}
      accessibilityLabel={`Activity: ${activity.title}`}
      accessibilityRole="button"
      // Keep the custom annotation snapshot immutable. Selection is announced
      // accessibly while the detail route opens; it never resizes MapKit UI.
      accessibilityState={{ selected }}
      tracksViewChanges={false}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View style={styles.hitTarget}>
        <View style={[styles.pin, { backgroundColor: color }]}>
          <Icon size={18} color={theme.text.inverse} weight="fill" />
        </View>
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  hitTarget: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  pin: {
    // Bigger and higher-contrast than Apple Maps' own default markers —
    // a plain 30px dot read as "just another map element" rather than a
    // deliberate, branded product marker.
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 3,
    borderColor: theme.background.surface,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.25,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});

/**
 * TODO: at scale, dense areas need clustering (react-native-map-clustering
 * or a supercluster-based custom layer) rather than one Marker per activity —
 * out of scope for MVP density, revisit once a market gets crowded.
 */
