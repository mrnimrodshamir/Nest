import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { theme, typography } from '@/theme';
import { useI18n } from '@/i18n';

export function PlaceClusterMarker({ latitude, longitude, count, selected, onPress }: { latitude: number; longitude: number; count: number; selected: boolean; onPress: () => void }) {
  const { t } = useI18n();
  return <Marker coordinate={{ latitude, longitude }} onPress={onPress} accessibilityLabel={t('map.placeCluster', { count })} accessibilityRole="button" accessibilityState={{ selected }} tracksViewChanges={false}>
    <View style={styles.hitTarget}><View style={styles.cluster}><Text style={styles.count}>{count > 99 ? '99+' : count}</Text></View></View>
  </Marker>;
}
const styles = StyleSheet.create({
  hitTarget: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  cluster: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.brand.secondary, borderWidth: 3, borderColor: theme.background.surface, shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 4, elevation: 4 },
  count: { ...typography.caption, color: theme.text.inverse, fontWeight: '700' },
});
