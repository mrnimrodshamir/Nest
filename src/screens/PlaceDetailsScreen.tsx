import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import { ArrowLeft, ArrowSquareOut, ShareNetwork, WarningCircle, WhatsappLogo } from 'phosphor-react-native';
import { PlaceImage } from '@/components/PlaceImage';
import { EventCard } from '@/components/EventCard';
import { ContentImageGallery } from '@/components/ContentImageGallery';
import { PrimaryButton } from '@/components/PrimaryButton';
import { StateCard } from '@/components/StateCard';
import { getFamilyFriendlyPlace } from '@/lib/familyFriendlyPlaces';
import { usePlaceEvents } from '@/hooks/usePlaceEvents';
import { radius, spacing, theme, typography } from '@/theme';
import type { FamilyFriendlyPlace } from '@/types/familyFriendlyPlace';
import type { EventDetails } from '@/types/event';
import { buildAppleMapsPlaceUrl, formatOpeningHours, placeWhatIsHere } from '@/utils/familyFriendlyPlace';
import { groupPlaceEvents } from '@/utils/placeEvents';
import { buildPlaceShareMessage } from '@/utils/contentSharing';
import { openNativeShare, openWhatsAppShare } from '@/lib/contentShare';
import { localizedPlaceArea, localizedPlaceName, placeCategoryLabel, useI18n, textAlignForContent } from '@/i18n';
import { Dimensions } from 'react-native';
import { resolveHeroMaxHeight } from '@/constants/activityArtFrame';
import { track } from '@/lib/analytics';

// Portrait-locked app, so a module-level read is stable.
const HERO_MAX = resolveHeroMaxHeight(Dimensions.get('window').height);

export function PlaceDetailsScreen({ placeId, onBack, onCreateActivity, onOpenEvent }: { placeId: string; onBack: () => void; onCreateActivity: (place: FamilyFriendlyPlace) => void; onOpenEvent: (event: EventDetails) => void }) {
  const [place, setPlace] = useState<FamilyFriendlyPlace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reload, setReload] = useState(0);
  const placeEvents = usePlaceEvents(placeId);
  const { t, locale } = useI18n();
  useEffect(() => {
    let active = true;
    setError(null);
    getFamilyFriendlyPlace(placeId).then((value) => active && setPlace(value)).catch(() => active && setError(t('place.loadError')));
    return () => { active = false; };
  }, [placeId, reload, t]);
  useEffect(() => {
    track('place_opened', { content_id: placeId, source: 'curated' });
  }, [placeId]);
  const facts = useMemo(() => place ? placeWhatIsHere(place, t) : [], [place, t]);
  const eventGroups = useMemo(() => groupPlaceEvents(placeEvents.events), [placeEvents.events]);

  if (!place) return <SafeAreaView style={styles.container}><Header onBack={onBack} />{error ? <StateCard icon={WarningCircle} title={t('place.loadError')} body={error} ctaLabel={t('common.retry')} onCtaPress={() => setReload((value) => value + 1)} tone="warning" /> : <Text style={styles.loading}>{t('place.loading')}</Text>}</SafeAreaView>;

  const address = place.formattedAddress ?? localizedPlaceArea(place.neighborhood, t) ?? place.city;
  const displayName = localizedPlaceName(place, locale);
  const mapsUrl = buildAppleMapsPlaceUrl(place);
  const openingHours = formatOpeningHours(place.openingHours);
  const description = place.fullDescription ?? place.shortDescription;
  const shareMessage = buildPlaceShareMessage({ id: place.id, name: displayName, location: address });
  return <SafeAreaView style={styles.container} edges={['top', 'bottom']}><Header onBack={onBack} /><ScrollView contentContainerStyle={styles.content}>
    <PlaceImage uri={place.coverImageUrl} asset={place.images?.cover} category={place.category} variant="cover" style={styles.hero} name={displayName} />
    {place.images?.gallery.length ? <ContentImageGallery images={place.images.gallery} /> : null}
    <Text style={styles.category}>{placeCategoryLabel(place.category, t)}</Text>
    <Text style={[styles.title, textAlignForContent(displayName, locale)]}>{displayName}</Text>
    <Text style={[styles.address, textAlignForContent(address, locale)]}>{address}</Text>
    <MapView style={styles.map} region={{ latitude: place.latitude, longitude: place.longitude, latitudeDelta: 0.015, longitudeDelta: 0.015 }} scrollEnabled={false} zoomEnabled={false} pointerEvents="none"><Marker coordinate={place} /></MapView>
    <Pressable style={styles.linkRow} onPress={() => Linking.openURL(mapsUrl)}><ArrowSquareOut size={18} color={theme.brand.primary} /><Text style={styles.link}>{t('place.openInAppleMaps')}</Text></Pressable>
    <View style={styles.shareRow}>
      {/* place.name is a venue name — interpolated, never translated. */}
      <Pressable accessibilityRole="button" accessibilityLabel={t('place.shareLabel', { name: displayName })} style={styles.shareButton} onPress={() => void openNativeShare(shareMessage, undefined, { contentType: 'place', contentId: place.id })}><ShareNetwork size={18} color={theme.text.primary} /><Text style={styles.shareText}>{t('common.share')}</Text></Pressable>
      <Pressable accessibilityRole="button" accessibilityLabel={t('place.shareWhatsAppLabel', { name: displayName })} style={styles.shareButton} onPress={() => void openWhatsAppShare(shareMessage, undefined, { contentType: 'place', contentId: place.id })}><WhatsappLogo size={18} color={theme.text.primary} weight="fill" /><Text style={styles.shareText}>{t('common.whatsapp')}</Text></Pressable>
    </View>
    {/* Venue description comes from the provider — rendered in its own script. */}
    {description ? <Text style={[styles.description, textAlignForContent(description, locale)]}>{description}</Text> : null}
    {facts.length ? <View style={styles.section}><Text style={styles.sectionTitle}>{t('place.whatsHere')}</Text><View style={styles.factWrap}>{facts.map((fact) => <View key={fact} style={styles.fact}><Text style={styles.factText}>{fact}</Text></View>)}</View></View> : null}
    {place.priceNote ? <Section title={t('place.cost')} body={place.priceNote} /> : null}
    {openingHours ? <Section title={t('place.openingHours')} body={openingHours} /> : null}
    {placeEvents.isLoading ? <Text style={styles.eventLoading}>{t('place.loadingEvents')}</Text> : null}
    {placeEvents.error ? <View style={styles.eventError}><Text style={styles.eventErrorText}>{placeEvents.error}</Text><Pressable onPress={placeEvents.refresh} accessibilityRole="button" accessibilityLabel={t('common.retry')}><Text style={styles.link}>{t('common.retry')}</Text></Pressable></View> : null}
    {eventGroups.today.length ? <EventSection title={t('place.todayHere')} events={eventGroups.today} onOpenEvent={onOpenEvent} /> : null}
    {eventGroups.upcoming.length ? <EventSection title={t('place.upcomingHere')} events={eventGroups.upcoming} onOpenEvent={onOpenEvent} /> : null}
    {place.websiteUrl ? <Pressable style={styles.linkRow} onPress={() => Linking.openURL(place.websiteUrl!)}><ArrowSquareOut size={18} color={theme.brand.primary} /><Text style={styles.link}>{t('place.visitWebsite')}</Text></Pressable> : null}
    {place.lastVerifiedAt ? <Text style={styles.verified}>{t('place.lastVerified', { date: new Date(place.lastVerifiedAt).toLocaleDateString(locale === 'he' ? 'he-IL' : 'en-US') })}</Text> : null}
    <PrimaryButton label={t('place.createActivityHere')} onPress={() => onCreateActivity(place)} />
  </ScrollView></SafeAreaView>;
}

function Header({ onBack }: { onBack: () => void }) {
  const { t, isRTL } = useI18n();
  return <View style={styles.header}><Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.back}>
    {/* The back arrow is directional: it must point back, which is right in
        a Hebrew layout. Non-directional icons are never flipped. */}
    <ArrowLeft size={20} color={theme.text.primary} style={isRTL ? styles.flipped : undefined} />
  </Pressable><Text style={styles.headerTitle}>{t('place.title')}</Text><View style={styles.back} /></View>;
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
  // Mirrors the back arrow in RTL. Applied only to genuinely directional
  // icons — a map pin or a heart must never be flipped.
  flipped: { transform: [{ scaleX: -1 }] },
  headerTitle: { ...typography.headline, color: theme.text.primary },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 48, gap: spacing.sm },
  loading: { ...typography.body, textAlign: 'center', color: theme.text.secondary, marginTop: 80 },
  // PlaceImage supplies the 4:3 ratio; this adds the screen-height ceiling the
  // Activity hero already gets from CoverFrame, so no detail hero can swallow a
  // small screen.
  hero: { borderRadius: radius.lg, maxHeight: HERO_MAX },
  category: { ...typography.footnote, color: theme.text.accent, textTransform: 'uppercase', marginTop: spacing.sm },
  title: { ...typography.title2, color: theme.text.primary },
  address: { ...typography.body, color: theme.text.secondary },
  map: { height: 180, borderRadius: radius.lg, marginTop: spacing.sm },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 44 },
  link: { ...typography.subhead, color: theme.brand.primary, fontWeight: '600' },
  shareRow: { flexDirection: 'row', gap: spacing.sm },
  shareButton: { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radius.md, backgroundColor: theme.background.surface, borderWidth: 1, borderColor: theme.border.default },
  shareText: { ...typography.subhead, color: theme.text.primary, fontWeight: '600' },
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
