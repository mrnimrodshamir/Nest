import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { theme, typography } from '@/theme';
import { useI18n } from '@/i18n';

/** One marker for multiple Event occurrences that share a real venue (see
 *  src/utils/eventVenueGrouping.ts). Keeps the diamond silhouette from
 *  EventMapPin so Events stay visually distinct from Activities/Places on the
 *  map, with a count badge communicating "N Events here" — the same idea as
 *  PlaceClusterMarker, but for venue grouping rather than zoom-level
 *  geographic clustering. */
export function EventVenueMarker({ latitude, longitude, count, selected, onPress }: { latitude: number; longitude: number; count: number; selected: boolean; onPress: () => void }) {
  const { t } = useI18n();
  return <Marker coordinate={{ latitude, longitude }} onPress={onPress} accessibilityLabel={t('map.eventVenueCluster', { count })} accessibilityRole="button" accessibilityState={{ selected }} tracksViewChanges={false} anchor={{ x: 0.5, y: 0.5 }}>
    <View style={styles.hitTarget}>
      <View style={styles.marker}><View style={styles.diamond} /></View>
      <View style={styles.badge}><Text style={styles.count}>{count > 99 ? '99+' : count}</Text></View>
    </View>
  </Marker>;
}

const styles = StyleSheet.create({
  hitTarget: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  marker: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  diamond: { width: 34, height: 34, transform: [{ rotate: '45deg' }], borderRadius: 7, borderWidth: 2, borderColor: '#FFFFFF', backgroundColor: '#5C86A0', shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  badge: { position: 'absolute', top: -4, right: -2, minWidth: 20, height: 20, paddingHorizontal: 4, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.brand.secondary, borderWidth: 2, borderColor: theme.background.surface },
  count: { ...typography.caption, fontSize: 11, lineHeight: 13, color: theme.text.inverse, fontWeight: '700' },
});
