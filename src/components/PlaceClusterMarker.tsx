import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { theme, typography } from '@/theme';

export function PlaceClusterMarker({ latitude, longitude, count, selected, onPress }: { latitude: number; longitude: number; count: number; selected: boolean; onPress: () => void }) {
  return <Marker coordinate={{ latitude, longitude }} onPress={onPress} tracksViewChanges={selected}>
    <View style={[styles.cluster, selected && styles.selected]}><Text style={styles.count}>{count > 99 ? '99+' : count}</Text></View>
  </Marker>;
}
const styles = StyleSheet.create({
  cluster: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.brand.secondary, borderWidth: 3, borderColor: theme.background.surface, shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 4, elevation: 4 },
  selected: { width: 48, height: 48, borderRadius: 24, backgroundColor: theme.brand.primary },
  count: { ...typography.caption, color: theme.text.inverse, fontWeight: '700' },
});
