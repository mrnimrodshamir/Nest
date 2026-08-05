import React, { useEffect, useMemo, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import { ArrowLeft, ArrowSquareOut, CheckCircle, MapPin, WarningCircle } from 'phosphor-react-native';
import { PrimaryButton } from '@/components/PrimaryButton';
import { StateCard } from '@/components/StateCard';
import { getFamilyFriendlyPlace } from '@/lib/familyFriendlyPlaces';
import { radius, spacing, theme, typography } from '@/theme';
import type { FamilyFriendlyPlace } from '@/types/familyFriendlyPlace';
import { PLACE_CATEGORY_LABELS } from '@/types/familyFriendlyPlace';
import { formatPlaceAgeRange, placeSummaryFeatures } from '@/utils/familyFriendlyPlace';

export function PlaceDetailsScreen({ placeId, onBack, onCreateActivity }: { placeId: string; onBack: () => void; onCreateActivity: (place: FamilyFriendlyPlace) => void }) {
  const [place, setPlace] = useState<FamilyFriendlyPlace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  useEffect(() => { let active = true; setError(null); getFamilyFriendlyPlace(placeId).then((value) => active && setPlace(value)).catch(() => active && setError("Couldn't load this place.")); return () => { active = false; }; }, [placeId, reload]);
  const features = useMemo(() => place ? placeSummaryFeatures({ ...place, shade: place.shade, toilets: place.toilets }) : [], [place]);

  if (!place) return <SafeAreaView style={styles.container}><Header onBack={onBack} />{error ? <StateCard icon={WarningCircle} title="Couldn't load place" body={error} ctaLabel="Try again" onCtaPress={() => setReload((v) => v + 1)} tone="warning" /> : <Text style={styles.loading}>Loading place…</Text>}</SafeAreaView>;
  const setting = [place.isIndoor ? 'Indoor' : null, place.isOutdoor ? 'Outdoor' : null, place.isFree === true ? 'Free' : place.isFree === false ? 'Paid' : null].filter(Boolean).join(' · ');
  const address = place.formattedAddress ?? place.neighborhood ?? place.city;
  const mapsUrl = `https://maps.apple.com/?ll=${place.latitude},${place.longitude}&q=${encodeURIComponent(place.name)}`;
  return <SafeAreaView style={styles.container} edges={['top', 'bottom']}><Header onBack={onBack} /><ScrollView contentContainerStyle={styles.content}>
    {place.coverImageUrl ? <Image source={{ uri: place.coverImageUrl }} style={styles.hero} /> : <View style={[styles.hero, styles.heroFallback]}><MapPin size={54} color={theme.brand.secondary} weight="fill" /></View>}
    <Text style={styles.category}>{PLACE_CATEGORY_LABELS[place.category]}</Text><Text style={styles.title}>{place.name}</Text>
    <Text style={styles.address}>{address}</Text>{setting ? <Text style={styles.setting}>{setting}</Text> : null}
    <MapView style={styles.map} region={{ latitude: place.latitude, longitude: place.longitude, latitudeDelta: 0.015, longitudeDelta: 0.015 }} scrollEnabled={false} zoomEnabled={false} pointerEvents="none"><Marker coordinate={place} /></MapView>
    <Pressable style={styles.linkRow} onPress={() => Linking.openURL(mapsUrl)}><ArrowSquareOut size={18} color={theme.brand.primary} /><Text style={styles.link}>Open in Apple Maps</Text></Pressable>
    {place.shortDescription ? <Text style={styles.description}>{place.fullDescription ?? place.shortDescription}</Text> : null}
    {place.minAgeMonths != null || place.maxAgeMonths != null ? <Section title="Age suitability" body={formatPlaceAgeRange(place.minAgeMonths, place.maxAgeMonths)} /> : null}
    {features.length ? <View style={styles.section}><Text style={styles.sectionTitle}>Family-friendly features</Text>{features.map((feature) => <View key={feature} style={styles.feature}><CheckCircle size={18} color={theme.brand.secondary} weight="fill" /><Text style={styles.featureText}>{feature}</Text></View>)}</View> : null}
    {place.openingHours ? <Section title="Opening hours" body="See the venue’s current schedule before you go." /> : null}
    {place.websiteUrl ? <Pressable style={styles.linkRow} onPress={() => Linking.openURL(place.websiteUrl!)}><ArrowSquareOut size={18} color={theme.brand.primary} /><Text style={styles.link}>Visit website</Text></Pressable> : null}
    {place.lastVerifiedAt ? <Text style={styles.verified}>Last verified {new Date(place.lastVerifiedAt).toLocaleDateString()}</Text> : null}
    <PrimaryButton label="Create activity here" onPress={() => onCreateActivity(place)} />
  </ScrollView></SafeAreaView>;
}

function Header({ onBack }: { onBack: () => void }) { return <View style={styles.header}><Pressable onPress={onBack} accessibilityLabel="Back" style={styles.back}><ArrowLeft size={20} color={theme.text.primary} /></Pressable><Text style={styles.headerTitle}>Place details</Text><View style={styles.back} /></View>; }
function Section({ title, body }: { title: string; body: string }) { return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.description}>{body}</Text></View>; }
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background.app }, header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm }, back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background.surface }, headerTitle: { ...typography.headline, color: theme.text.primary },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 48, gap: spacing.sm }, loading: { ...typography.body, textAlign: 'center', color: theme.text.secondary, marginTop: 80 }, hero: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg, backgroundColor: theme.background.surfaceAlt }, heroFallback: { alignItems: 'center', justifyContent: 'center' },
  category: { ...typography.footnote, color: theme.text.accent, textTransform: 'uppercase', marginTop: spacing.sm }, title: { ...typography.title2, color: theme.text.primary }, address: { ...typography.body, color: theme.text.secondary }, setting: { ...typography.subhead, color: theme.text.primary }, map: { height: 180, borderRadius: radius.lg, marginTop: spacing.sm },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 44 }, link: { ...typography.subhead, color: theme.brand.primary, fontWeight: '600' }, description: { ...typography.body, color: theme.text.secondary, lineHeight: 23 }, section: { paddingVertical: spacing.sm }, sectionTitle: { ...typography.headline, color: theme.text.primary, marginBottom: spacing.xs }, feature: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center', marginVertical: 4 }, featureText: { ...typography.body, color: theme.text.primary }, verified: { ...typography.caption, color: theme.text.muted, marginVertical: spacing.sm },
});
