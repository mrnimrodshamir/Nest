import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PlaceImage } from '@/components/PlaceImage';
import { radius, spacing, theme, typography } from '@/theme';
import type { FamilyFriendlyPlace } from '@/types/familyFriendlyPlace';
import { PLACE_CATEGORY_LABELS } from '@/types/familyFriendlyPlace';
import { formatPlaceDistance, placeSummaryFeatures } from '@/utils/familyFriendlyPlace';

export function PlaceCard({ place, highlighted, onPress }: { place: FamilyFriendlyPlace; highlighted?: boolean; onPress: (place: FamilyFriendlyPlace) => void }) {
  const distance = formatPlaceDistance(place.distanceMeters);
  const features = placeSummaryFeatures(place);
  const setting = [place.isIndoor ? 'Indoor' : null, place.isOutdoor ? 'Outdoor' : null, place.isFree === true ? 'Free' : place.isFree === false ? 'Paid' : null].filter(Boolean).join(' · ');
  return <Pressable accessibilityRole="button" accessibilityLabel={`${place.name}, ${PLACE_CATEGORY_LABELS[place.category]}`} onPress={() => onPress(place)} style={({ pressed }) => [styles.card, highlighted && styles.highlighted, pressed && styles.pressed]}>
    <PlaceImage uri={place.coverImageUrl} asset={place.images?.card ?? place.images?.cover} category={place.category} variant="card" name={place.name} />
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
  // minHeight keeps the row able to grow for long text, but the image is now
  // explicitly 116 tall and alignSelf:'flex-start', so the row's height can
  // never be driven by the image. maxHeight bounds the worst case on small
  // screens so one card can never dominate the feed.
  card: { flexDirection: 'row', minHeight: 116, maxHeight: 168, backgroundColor: theme.background.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border.default, overflow: 'hidden', marginBottom: spacing.sm },
  highlighted: { borderColor: theme.brand.secondary, borderWidth: 1.5 }, pressed: { opacity: 0.86 },
  body: { flex: 1, padding: spacing.md, justifyContent: 'center' },
  title: { ...typography.subhead, fontWeight: '700', color: theme.text.primary },
  meta: { ...typography.footnote, color: theme.text.secondary, marginTop: 2 },
  distance: { ...typography.caption, color: theme.text.accent, marginTop: 3 },
  setting: { ...typography.footnote, color: theme.text.primary, marginTop: 5 },
  features: { ...typography.caption, color: theme.text.secondary, marginTop: 3 },
});
