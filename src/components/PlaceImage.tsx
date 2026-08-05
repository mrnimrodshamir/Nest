import React, { useEffect, useState } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Baby, Buildings, House, MapPin, Park, SwimmingPool, Umbrella } from 'phosphor-react-native';
import { theme } from '@/theme';
import type { PlaceCategory } from '@/types/familyFriendlyPlace';

const CATEGORY_ICONS: Partial<Record<PlaceCategory, React.ComponentType<{ size: number; color: string; weight?: 'fill' }>>> = {
  playground: Baby, park: Park, picnic_area: Park, indoor_playground: House,
  museum: Buildings, library: Buildings, community_center: Buildings,
  zoo_or_animals: Baby, beach: Umbrella, pool: SwimmingPool,
};

const CATEGORY_COLORS: Record<PlaceCategory, string> = {
  playground: '#D9EEF0', park: '#E0EEDF', indoor_playground: '#ECE4F6',
  zoo_or_animals: '#E9EDDA', museum: '#E4E8F1', library: '#EEE6F0', beach: '#DDEFF8', pool: '#DDF1F3',
  community_center: '#F1E7E4', attraction: '#F5E5EC', picnic_area: '#E4EEDF', other: theme.background.surfaceAlt,
};

export function PlaceImage({ uri, category, variant, style }: { uri: string | null; category: PlaceCategory; variant: 'card' | 'cover'; style?: StyleProp<ViewStyle> }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [uri]);
  const Icon = CATEGORY_ICONS[category] ?? MapPin;
  return <View style={[variant === 'card' ? styles.card : styles.cover, style, { backgroundColor: CATEGORY_COLORS[category] }]}>
    {uri && !failed
      ? <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="cover" onError={() => setFailed(true)} accessibilityIgnoresInvertColors />
      : <Icon size={variant === 'cover' ? 58 : 36} color={theme.brand.primary} weight="fill" />}
  </View>;
}

const styles = StyleSheet.create({
  card: { width: 112, minHeight: 116, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cover: { width: '100%', aspectRatio: 4 / 3, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
