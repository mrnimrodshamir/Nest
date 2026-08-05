import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import { ArrowLeft, ArrowSquareOut, WarningCircle } from 'phosphor-react-native';
import { PlaceImage } from '@/components/PlaceImage';
import { EventCard } from '@/components/EventCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { StateCard } from '@/components/StateCard';
import { getFamilyFriendlyPlace } from '@/lib/familyFriendlyPlaces';
import { usePlaceEvents } from '@/hooks/usePlaceEvents';
import { radius, spacing, theme, typography } from '@/theme';
import type { FamilyFriendlyPlace } from '@/types/familyFriendlyPlace';
import type { EventDetails } from '@/types/event';
import { PLACE_CATEGORY_LABELS } from '@/types/familyFriendlyPlace';
import { buildAppleMapsPlaceUrl, formatOpeningHours, placeWhatIsHere } from '@/utils/familyFriendlyPlace';
import { groupPlaceEvents } from '@/utils/placeEvents';

export function PlaceDetailsScreen({ placeId, onBack, onCreateActivity, onOpenEvent }: { placeId: string; onBack: () => void; onCreateActivity: (place: FamilyFriendlyPlace) => void; onOpenEvent: (event: EventDetails) => void }) {
  const [place, setPlace] = useState<FamilyFriendlyPlace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const placeEvents = usePlaceEvents(placeId);
  useEffect(() => {
    let active = true;
    setError(null);
    getFamilyFriendlyPlace(placeId).then((value) => active && setPlace(value)).catch(() => active && setError("Couldn't load this place."));
    return () => { active = false; };
  }, [placeId, reload]);
  const facts = useMemo(() => place ? placeWhatIsHere(place) : [], [place]);
  const eventGroups = useMemo(() => groupPlaceEvents(placeEvents.events), [placeEvents.events]);

  if (!place) return <SafeAreaView style={styles.container}><Header onBack={onBack} />{error ? <StateCard icon={WarningCircle} title="Couldn't load place" body={error} ctaLabel="Try again" onCtaPress={() => setReload((value) => value + 1)} tone="warning" /> : <Text style={styles.loading}>Loading place…</Text>}</SafeAreaView>;

  const address = place.formattedAddress ?? place.neighborhood ?? place.city;
  const mapsUrl = buildAppleMapsPlaceUrl(place);
  const openingHours = formatOpeningHours(place.openingHours);
  const description = place.fullDescription ?? place.shortDescription;
  return <SafeAreaView style={styles.container} edges={['top', 'bottom']}><Header onBack={onBack} /><ScrollView contentContainerStyle={styles.content}>
    <PlaceImage uri={place.coverImageUrl} category={place.category} variant="cover" style={styles.hero} />
    <Text style={styles.category}>{PLACE_CATEGORY_LABELS[place.category]}</Text>
    <Text style={styles.title}>{place.name}</Text>
    <Text style={styles.address}>{address}</Text>
    <MapView style={styles.map} region={{ latitude: place.latitude, longitude: place.longitude, latitudeDelta: 0.015, longitudeDelta: 0.015 }} scrollEnabled={false} zoomEnabled={false} pointerEvents="none"><Marker coordinate={place} /></MapView>
    <Pressable style={styles.linkRow} onPress={() => Linking.openURL(mapsUrl)}><ArrowSquareOut size={18} color={theme.brand.primary} /><Text style={styles.link}>Open in Apple Maps</Text></Pressable>
    {description ? <Text style={styles.description}>{description}</Text> : null}
    {facts.length ? <View style={styles.section}><Text style={styles.sectionTitle}>What's here</Text><View style={styles.factWrap}>{facts.map((fact) => <View key={fact} style={styles.fact}><Text style={styles.factText}>{fact}</Text></View>)}</View></View> : null}
    {place.priceNote ? <Section title="Cost" body={place.priceNote} /> : null}
    {openingHours ? <Section title="Opening hours" body={openingHours} /> : null}
    {placeEvents.isLoading ? <Text style={styles.eventLoading}>Loading events here…</Text> : null}
    {placeEvents.error ? <View style={styles.eventError}><Text style={styles.eventErrorText}>{placeEvents.error}</Text><Pressable onPress={placeEvents.refresh}><Text style={styles.link}>Try again</Text></Pressable></View> : null}
    {eventGroups.today.length ? <EventSection title="Today Here" events={eventGroups.today} onOpenEvent={onOpenEvent} /> : null}
    {eventGroups.upcoming.length ? <EventSection title="Upcoming Here" events={eventGroups.upcoming} onOpenEvent={onOpenEvent} /> : null}
    {place.websiteUrl ? <Pressable style={styles.linkRow} onPress={() => Linking.openURL(place.websiteUrl!)}><ArrowSquareOut size={18} color={theme.brand.primary} /><Text style={styles.link}>Visit website</Text></Pressable> : null}
    {place.lastVerifiedAt ? <Text style={styles.verified}>Last verified {new Date(place.lastVerifiedAt).toLocaleDateString()}</Text> : null}
    <PrimaryButton label="Create activity here" onPress={() => onCreateActivity(place)} />
  </ScrollView></SafeAreaView>;
}

function Header({ onBack }: { onBack: () => void }) {
  return <View style={styles.header}><Pressable onPress={onBack} accessibilityLabel="Back" style={styles.back}><ArrowLeft size={20} color={theme.text.primary} /></Pressable><Text style={styles.headerTitle}>Place details</Text><View style={styles.back} /></View>;
}

function Section({ title, body }: { title: string; body: string }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.description}>{body}</Text></View>;
}

function EventSection({ title, events, onOpenEvent }: { title: string; events: EventDetails[]; onOpenEvent: (event: EventDetails) => void }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text>{events.map((event) => <EventCard key={event.occurrence.id} event={event} compact onPress={onOpenEvent} />)}</View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background.app },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background.surface },
  headerTitle: { ...typography.headline, color: theme.text.primary },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 48, gap: spacing.sm },
  loading: { ...typography.body, textAlign: 'center', color: theme.text.secondary, marginTop: 80 },
  hero: { borderRadius: radius.lg },
  category: { ...typography.footnote, color: theme.text.accent, textTransform: 'uppercase', marginTop: spacing.sm },
  title: { ...typography.title2, color: theme.text.primary },
  address: { ...typography.body, color: theme.text.secondary },
  map: { height: 180, borderRadius: radius.lg, marginTop: spacing.sm },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 44 },
  link: { ...typography.subhead, color: theme.brand.primary, fontWeight: '600' },
  description: { ...typography.body, color: theme.text.secondary, lineHeight: 23 },
  section: { paddingVertical: spacing.sm },
  sectionTitle: { ...typography.headline, color: theme.text.primary, marginBottom: spacing.xs },
  factWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  fact: { minHeight: 34, justifyContent: 'center', paddingHorizontal: spacing.sm, borderRadius: radius.pill, backgroundColor: theme.background.surfaceAlt },
  factText: { ...typography.footnote, color: theme.text.primary, fontWeight: '600' },
  verified: { ...typography.caption, color: theme.text.muted, marginVertical: spacing.sm },
  eventLoading: { ...typography.footnote, color: theme.text.muted, paddingVertical: spacing.sm },
  eventError: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, padding: spacing.sm, borderRadius: radius.md, backgroundColor: theme.semantic.warningTint },
  eventErrorText: { ...typography.footnote, color: theme.text.primary, flex: 1 },
});
