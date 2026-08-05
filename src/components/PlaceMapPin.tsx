import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';
import { Baby, Buildings, House, MapPin, Park, SwimmingPool, Umbrella } from 'phosphor-react-native';
import { theme } from '@/theme';
import type { FamilyFriendlyPlace, PlaceCategory } from '@/types/familyFriendlyPlace';

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
  const Icon = ICONS[place.category] ?? MapPin;
  return <Marker coordinate={place} onPress={() => onPress(place)} accessibilityLabel={`Place: ${place.name}`} accessibilityRole="button" tracksViewChanges={selected} anchor={{ x: 0.5, y: 0.5 }}>
    <View style={[styles.marker, { backgroundColor: COLORS[place.category] }, selected && styles.selected]}>
      <Icon size={selected ? 21 : 17} color={theme.text.inverse} weight="fill" />
    </View>
  </Marker>;
}
const styles = StyleSheet.create({
  marker: { width: 34, height: 34, borderRadius: 8, borderWidth: 2, borderColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 3, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  selected: { width: 42, height: 42, borderRadius: 10, borderWidth: 3 },
});
