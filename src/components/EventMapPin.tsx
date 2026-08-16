import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { CalendarDots } from 'phosphor-react-native';
import { theme } from '@/theme';
import type { EventDetails } from '@/types/event';
import { displayedEventContent } from '../../supabase/functions/_shared/eventTranslation';

/** Events use a diamond marker, distinct from circular Activities and square Places. */
export function EventMapPin({ event, selected, onPress }: { event: EventDetails; selected: boolean; onPress: (event: EventDetails) => void }) {
  const content = displayedEventContent(event);
  return <Marker coordinate={event.location} onPress={() => onPress(event)} accessibilityLabel={`Event: ${content.title}`} accessibilityRole="button" accessibilityState={{ selected }} tracksViewChanges={false} anchor={{ x: 0.5, y: 0.5 }}>
    <View style={styles.hitTarget}><View style={styles.marker}><View style={styles.icon}><CalendarDots size={17} color={theme.text.inverse} weight="fill" /></View></View></View>
  </Marker>;
}

const styles = StyleSheet.create({
  hitTarget: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  marker: { width: 34, height: 34, transform: [{ rotate: '45deg' }], borderRadius: 7, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', backgroundColor: '#5C86A0', shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  icon: { transform: [{ rotate: '-45deg' }] },
});
