import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { Baby, Buildings, House, MapPin, Park, SwimmingPool, Umbrella } from 'phosphor-react-native';
import { theme } from '@/theme';
import type { FamilyFriendlyPlace, PlaceCategory } from '@/types/familyFriendlyPlace';
import { localizedPlaceName, useI18n } from '@/i18n';

const ICONS: Partial<Record<PlaceCategory, React.ComponentType<{ size: number; color: string; weight?: 'fill' | 'bold' }>>> = {
  playground: Baby, park: Park, picnic_area: Park, indoor_playground: House,
  museum: Buildings, library: Buildings, community_center: Buildings, zoo_or_animals: Baby,
  beach: Umbrella, pool: SwimmingPool,
};
const COLORS: Record<PlaceCategory, string> = {
  playground: '#276A73', park: '#347A4A', indoor_playground: '#7253A3',
  zoo_or_animals: '#6B7A36', museum: '#4C6190', library: '#735680', beach: '#2E77A8', pool: '#2A8FA0',
  community_center: '#8A5D55', attraction: '#B26784', picnic_area: '#557A45', other: '#59656F',
};

export function PlaceMapPin({ place, selected, onPress }: { place: FamilyFriendlyPlace; selected: boolean; onPress: (place: FamilyFriendlyPlace) => void }) {
  const { t, locale } = useI18n();
  const Icon = ICONS[place.category] ?? MapPin;
  return <Marker coordinate={place} onPress={() => onPress(place)} accessibilityLabel={t('map.placeMarker', { name: localizedPlaceName(place, locale) })} accessibilityRole="button" accessibilityState={{ selected }} tracksViewChanges={false} anchor={{ x: 0.5, y: 0.5 }}>
    <View style={styles.hitTarget}><View style={[styles.marker, { backgroundColor: COLORS[place.category] }]}>
      <Icon size={17} color={theme.text.inverse} weight="fill" />
    </View></View>
  </Marker>;
}
const styles = StyleSheet.create({
  hitTarget: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  marker: { width: 34, height: 34, borderRadius: 8, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
});
