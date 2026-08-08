import React, { useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ArrowSquareOut, CalendarDots, CalendarPlus, MapPin, Repeat, ShareNetwork, WarningCircle, WhatsappLogo } from 'phosphor-react-native';
import { ContentImage } from '@/components/ContentImage';
import { ContentImageGallery } from '@/components/ContentImageGallery';
import { radius, spacing, theme, typography } from '@/theme';
import type { EventDetails } from '@/types/event';
import { buildEventDetailsPresentation } from '@/utils/eventPresentation';
import { buildEventShareMessage } from '@/utils/contentSharing';
import { openNativeShare, openWhatsAppShare } from '@/lib/contentShare';
import { AddEventToCalendarSheet } from '@/components/AddEventToCalendarSheet';
import { useI18n, textAlignForContent } from '@/i18n';

interface EventDetailsScreenProps {
  event: EventDetails;
  onBack: () => void;
}

/** Standalone Sprint 6 detail surface. It is intentionally not registered in
 * Discovery or navigation until Events publication is separately approved. */
export function EventDetailsScreen({ event, onBack }: EventDetailsScreenProps) {
  const content = useMemo(() => buildEventDetailsPresentation(event), [event]);
  const { t, locale, isRTL } = useI18n();
  const [showCalendar, setShowCalendar] = useState(false);
  const isInterrupted = event.lifecycle === 'cancelled' || event.lifecycle === 'postponed';
  const shareMessage = buildEventShareMessage({ occurrenceId: event.occurrence.id, title: event.title, startsAt: event.occurrence.startsAt, location: event.location.name ?? event.location.formattedAddress, status: event.occurrence.status });
  const calendarEvent = { occurrenceId: event.occurrence.id, title: event.title, description: event.description, startsAt: event.occurrence.startsAt, endsAt: event.occurrence.endsAt, locationName: event.location.name ?? event.location.formattedAddress, sourceUrl: event.source.sourceUrl, status: event.occurrence.status };
  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.back}>
          {/* Directional icon: must point back, which flips in RTL. */}
          <ArrowLeft size={20} color={theme.text.primary} style={isRTL ? styles.flipped : undefined} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('event.title')}</Text>
        <View style={styles.back} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <ContentImage asset={event.images?.cover} legacyUri={event.imageUrl} variant="cover" style={styles.hero} accessibilityLabel={`${event.title} event image`} deferUntilInteraction={false} fallback={<CalendarDots size={52} color={theme.brand.primary} weight="duotone" />} />
        {event.images?.gallery.length ? <ContentImageGallery images={event.images.gallery} /> : null}
        <View style={styles.labelRow}>
          <Text style={styles.category}>{content.categoryLabel}</Text>
          <View style={[styles.status, isInterrupted && styles.statusInterrupted]}>
            <Text style={[styles.statusText, isInterrupted && styles.statusTextInterrupted]}>{content.lifecycleLabel}</Text>
          </View>
        </View>
        <Text style={styles.title}>{content.title}</Text>
        {content.cancellationMessage ? (
          <View style={styles.alert}><WarningCircle size={20} color={theme.semantic.danger} /><Text style={styles.alertText}>{content.cancellationMessage}</Text></View>
        ) : null}
        <InfoRow icon={CalendarDots} title={content.dateLabel} body={content.timeLabel} />
        {content.recurrenceLabel ? <InfoRow icon={Repeat} title={content.recurrenceLabel} /> : null}
        <InfoRow icon={MapPin} title={content.locationName} body={content.addressLabel} />
        <View style={styles.actionRow}>
          {/* event.title comes from an external source — interpolated only. */}
          <Pressable accessibilityRole="button" accessibilityLabel={t('place.shareLabel', { name: event.title })} style={styles.action} onPress={() => void openNativeShare(shareMessage)}><ShareNetwork size={18} color={theme.text.primary} /><Text style={styles.actionText}>{t('common.share')}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('place.shareWhatsAppLabel', { name: event.title })} style={styles.action} onPress={() => void openWhatsAppShare(shareMessage)}><WhatsappLogo size={18} color={theme.text.primary} weight="fill" /><Text style={styles.actionText}>{t('common.whatsapp')}</Text></Pressable>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('event.addToCalendarLabel', { name: event.title })} style={styles.calendarAction} onPress={() => setShowCalendar(true)}><CalendarPlus size={18} color={theme.brand.primary} /><Text style={styles.link}>{t('common.addToCalendar')}</Text></Pressable>
        <MapView
          style={styles.map}
          region={{ latitude: event.location.latitude, longitude: event.location.longitude, latitudeDelta: 0.015, longitudeDelta: 0.015 }}
          scrollEnabled={false}
          zoomEnabled={false}
          pointerEvents="none"
        >
          <Marker coordinate={event.location} />
        </MapView>
        {/* External event copy — rendered in whatever script it arrives in. */}
        {content.description ? <Text style={[styles.description, textAlignForContent(content.description, locale)]}>{content.description}</Text> : null}
        {event.priceNote ? <Section title={t('place.cost')} body={event.priceNote} /> : null}
        {content.registrationLabel && content.registrationUrl ? <ExternalLink label={content.registrationLabel} url={content.registrationUrl} /> : null}
        {content.sourceLabel ? <View style={styles.source}><Text style={styles.sourceText}>{content.sourceLabel}</Text>{content.sourceUrl ? <ExternalLink label={t('event.viewSource')} url={content.sourceUrl} /> : null}</View> : null}
      </ScrollView>
      <AddEventToCalendarSheet visible={showCalendar} event={calendarEvent} onDismiss={() => setShowCalendar(false)} />
    </SafeAreaView>
  );
}

function InfoRow({ icon: Icon, title, body }: { icon: typeof CalendarDots; title: string; body?: string | null }) {
  return <View style={styles.infoRow}><Icon size={21} color={theme.brand.primary} /><View style={styles.infoText}><Text style={styles.infoTitle}>{title}</Text>{body && body !== title ? <Text style={styles.infoBody}>{body}</Text> : null}</View></View>;
}

function Section({ title, body }: { title: string; body: string }) {
  return <View style={styles.section}><Text style={styles.sectionTitle}>{title}</Text><Text style={styles.description}>{body}</Text></View>;
}

function ExternalLink({ label, url }: { label: string; url: string }) {
  return <Pressable accessibilityRole="link" style={styles.linkRow} onPress={() => Linking.openURL(url)}><ArrowSquareOut size={18} color={theme.brand.primary} /><Text style={styles.link}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background.app },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background.surface },
  // Directional icons only — never applied to map pins or category glyphs.
  flipped: { transform: [{ scaleX: -1 }] },
  headerTitle: { ...typography.headline, color: theme.text.primary },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 48, gap: spacing.md },
  hero: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.lg, backgroundColor: theme.background.surfaceAlt },
  labelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  category: { ...typography.footnote, color: theme.text.accent, textTransform: 'uppercase' },
  status: { paddingHorizontal: spacing.sm, paddingVertical: spacing.xs, borderRadius: radius.pill, backgroundColor: theme.brand.primaryTint },
  statusInterrupted: { backgroundColor: theme.semantic.dangerTint },
  statusText: { ...typography.caption, color: theme.text.accent },
  statusTextInterrupted: { color: theme.semantic.danger },
  title: { ...typography.title1, color: theme.text.primary },
  alert: { flexDirection: 'row', gap: spacing.sm, padding: spacing.md, borderRadius: radius.md, backgroundColor: theme.semantic.dangerTint },
  alertText: { ...typography.subhead, color: theme.text.primary, flex: 1 },
  infoRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start', minHeight: 44 },
  infoText: { flex: 1 },
  infoTitle: { ...typography.bodyMedium, color: theme.text.primary },
  infoBody: { ...typography.subhead, color: theme.text.secondary, marginTop: 2 },
  map: { height: 180, borderRadius: radius.lg },
  description: { ...typography.body, color: theme.text.secondary, lineHeight: 23 },
  section: { paddingVertical: spacing.xs },
  sectionTitle: { ...typography.headline, color: theme.text.primary, marginBottom: spacing.xs },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 44 },
  link: { ...typography.subhead, color: theme.brand.primary, fontWeight: '600' },
  actionRow: { flexDirection: 'row', gap: spacing.sm },
  action: { flex: 1, minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radius.md, backgroundColor: theme.background.surface, borderWidth: 1, borderColor: theme.border.default },
  actionText: { ...typography.subhead, color: theme.text.primary, fontWeight: '600' },
  calendarAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  source: { paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border.default },
  sourceText: { ...typography.caption, color: theme.text.muted },
});
