import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MapPin } from 'phosphor-react-native';
import { radius, spacing, theme, typography } from '@/theme';
import type { FamilyFriendlyPlace } from '@/types/familyFriendlyPlace';
import { PLACE_CATEGORY_LABELS } from '@/types/familyFriendlyPlace';
import { formatPlaceDistance, placeSummaryFeatures } from '@/utils/familyFriendlyPlace';

export function PlaceCard({ place, highlighted, onPress }: { place: FamilyFriendlyPlace; highlighted?: boolean; onPress: (place: FamilyFriendlyPlace) => void }) {
  const distance = formatPlaceDistance(place.distanceMeters);
  const features = placeSummaryFeatures(place);
  const setting = [place.isIndoor ? 'Indoor' : null, place.isOutdoor ? 'Outdoor' : null, place.isFree === true ? 'Free' : place.isFree === false ? 'Paid' : null].filter(Boolean).join(' · ');
  return <Pressable accessibilityRole="button" accessibilityLabel={`${place.name}, ${PLACE_CATEGORY_LABELS[place.category]}`} onPress={() => onPress(place)} style={({ pressed }) => [styles.card, highlighted && styles.highlighted, pressed && styles.pressed]}>
    {place.coverImageUrl ? <Image source={{ uri: place.coverImageUrl }} style={styles.image} /> : <View style={styles.fallback}><MapPin size={34} color={theme.brand.secondary} weight="fill" /></View>}
    <View style={styles.body}>
      <Text style={styles.title} numberOfLines={1}>{place.name}</Text>
      <Text style={styles.meta} numberOfLines={1}>{[PLACE_CATEGORY_LABELS[place.category], place.neighborhood].filter(Boolean).join(' · ')}</Text>
      {distance ? <Text style={styles.distance}>{distance}</Text> : null}
      {setting ? <Text style={styles.setting}>{setting}</Text> : null}
      {features.length ? <Text style={styles.features} numberOfLines={1}>{features.join(' · ')}</Text> : null}
    </View>
  </Pressable>;
}
const styles = StyleSheet.create({
  card: { flexDirection: 'row', minHeight: 116, backgroundColor: theme.background.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border.default, overflow: 'hidden', marginBottom: spacing.sm },
  highlighted: { borderColor: theme.brand.secondary, borderWidth: 1.5 }, pressed: { opacity: 0.86 },
  image: { width: 112, minHeight: 116, backgroundColor: theme.background.surfaceAlt },
  fallback: { width: 112, minHeight: 116, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.brand.secondaryTint },
  body: { flex: 1, padding: spacing.md, justifyContent: 'center' },
  title: { ...typography.subhead, fontWeight: '700', color: theme.text.primary },
  meta: { ...typography.footnote, color: theme.text.secondary, marginTop: 2 },
  distance: { ...typography.caption, color: theme.text.accent, marginTop: 3 },
  setting: { ...typography.footnote, color: theme.text.primary, marginTop: 5 },
  features: { ...typography.caption, color: theme.text.secondary, marginTop: 3 },
});
