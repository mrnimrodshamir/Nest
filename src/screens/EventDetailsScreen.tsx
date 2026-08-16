import React, { useEffect, useMemo, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ArrowSquareOut, CalendarDots, CalendarPlus, Check, MapPin, Repeat, ShareNetwork, WarningCircle, WhatsappLogo } from 'phosphor-react-native';
import { radius, spacing, theme, typography } from '@/theme';
import type { EventDetails } from '@/types/event';
import { buildEventDetailsPresentation } from '@/utils/eventPresentation';
import { buildEventShareMessage } from '@/utils/contentSharing';
import { openNativeShare, openWhatsAppShare } from '@/lib/contentShare';
import { Dimensions } from 'react-native';
import { resolveHeroMaxHeight } from '@/constants/activityArtFrame';

// Module scope is safe: the app is portrait-locked (app.json), so window
// height does not change for the lifetime of the process.
const HERO_MAX = resolveHeroMaxHeight(Dimensions.get('window').height);
import { AddEventToCalendarSheet } from '@/components/AddEventToCalendarSheet';
import { dateLocaleTag, useI18n, textAlignForContent } from '@/i18n';
import { useEventRsvp } from '@/hooks/useEventRsvp';
import { rsvpPresentation, attendanceSummaryKey, attendeePreview } from '@/utils/eventAttendance';
import { PersonCard } from '@/components/PersonCard';
import { EventAttendeesSheet } from '@/components/EventAttendeesSheet';
import { track } from '@/lib/analytics';
import { RenderGuard } from '@/components/RenderGuard';

interface EventDetailsScreenProps {
  event: EventDetails;
  onBack: () => void;
  /** Opens an attendee's existing Public Profile. Optional so the screen still
   *  renders in contexts that have no profile route wired. */
  onOpenProfile?: (userId: string) => void;
}

/** Standalone Sprint 6 detail surface. It is intentionally not registered in
 * Discovery or navigation until Events publication is separately approved. */
export function EventDetailsScreen({ event, onBack, onOpenProfile }: EventDetailsScreenProps) {
  const { t, isRTL } = useI18n();
  const fallback = (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={t('common.back')} style={styles.back}>
          <ArrowLeft size={20} color={theme.text.primary} style={isRTL ? styles.flipped : undefined} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('event.title')}</Text>
        <View style={styles.back} />
      </View>
      <View style={styles.failSafeContent}>
        <Text style={styles.title}>{typeof event.title === 'string' && event.title.trim() ? event.title : t('event.title')}</Text>
      </View>
    </SafeAreaView>
  );
  return <RenderGuard resetKey={event.occurrence?.id ?? event.id} fallback={fallback}>
    <EventDetailsContent event={event} onBack={onBack} onOpenProfile={onOpenProfile} />
  </RenderGuard>;
}

function EventDetailsContent({ event, onBack, onOpenProfile }: EventDetailsScreenProps) {
  const { t, locale, isRTL } = useI18n();
  const content = useMemo(() => buildEventDetailsPresentation(event, dateLocaleTag(locale)), [event, locale]);
  const [showCalendar, setShowCalendar] = useState(false);
  const [showAttendees, setShowAttendees] = useState(false);
  const { isGoing, attendees, attendeeCount, isSaving, toggle } = useEventRsvp(event.occurrence.id);
  const rsvp = rsvpPresentation({ isGoing, attendeeCount, lifecycle: event.lifecycle });
  const attendanceSummary = attendanceSummaryKey(attendeeCount);
  const preview = attendeePreview(attendees);
  const isInterrupted = event.lifecycle === 'cancelled' || event.lifecycle === 'postponed';
  const shareMessage = buildEventShareMessage({ occurrenceId: event.occurrence.id, title: content.title, startsAt: event.occurrence.startsAt, location: event.location.name ?? event.location.formattedAddress, status: event.occurrence.status });
  const calendarEvent = { occurrenceId: event.occurrence.id, title: content.title, description: content.description, startsAt: event.occurrence.startsAt, endsAt: event.occurrence.endsAt, locationName: event.location.name ?? event.location.formattedAddress, sourceUrl: event.source.sourceUrl, status: event.occurrence.status };
  useEffect(() => {
    track('event_opened', { content_id: event.occurrence.id, source: event.source.provider });
  }, [event.occurrence.id, event.source.provider]);
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
        {/* Build 36 P0: keep Event opening independent of provider-controlled
            media and native detail-map mounts. TestFlight reports only an
            RCTFatal bridge abort, so React error boundaries cannot protect
            these native surfaces. The core Event, RSVP and actions remain
            available while the crash source is fail-closed. */}
        <View style={styles.hero} accessibilityLabel={`${content.title} event`}>
          <CalendarDots size={52} color={theme.brand.primary} weight="duotone" />
        </View>
        <View style={styles.labelRow}>
          <Text style={styles.category}>{content.categoryLabel}</Text>
          <View style={[styles.status, isInterrupted && styles.statusInterrupted]}>
            <Text style={[styles.statusText, isInterrupted && styles.statusTextInterrupted]}>{content.lifecycleLabel}</Text>
          </View>
        </View>
        <Text style={[styles.title, textAlignForContent(content.title, locale)]}>{content.title}</Text>
        {content.cancellationMessage ? (
          <View style={styles.alert}><WarningCircle size={20} color={theme.semantic.danger} /><Text style={styles.alertText}>{content.cancellationMessage}</Text></View>
        ) : null}
        <InfoRow icon={CalendarDots} title={content.dateLabel} body={content.timeLabel} />
        {content.recurrenceLabel ? <InfoRow icon={Repeat} title={content.recurrenceLabel} /> : null}
        <InfoRow icon={MapPin} title={content.locationName} body={content.addressLabel} />
        <View style={styles.actionRow}>
          <Pressable accessibilityRole="button" accessibilityLabel={t('place.shareLabel', { name: content.title })} style={styles.action} onPress={() => void openNativeShare(shareMessage, undefined, { contentType: 'event', contentId: event.occurrence.id })}><ShareNetwork size={18} color={theme.text.primary} /><Text style={styles.actionText}>{t('common.share')}</Text></Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel={t('place.shareWhatsAppLabel', { name: content.title })} style={styles.action} onPress={() => void openWhatsAppShare(shareMessage, undefined, { contentType: 'event', contentId: event.occurrence.id })}><WhatsappLogo size={18} color={theme.text.primary} weight="fill" /><Text style={styles.actionText}>{t('common.whatsapp')}</Text></Pressable>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={t('event.addToCalendarLabel', { name: content.title })} style={styles.calendarAction} onPress={() => setShowCalendar(true)}><CalendarPlus size={18} color={theme.brand.primary} /><Text style={styles.link}>{t('common.addToCalendar')}</Text></Pressable>
        {/* External event copy — rendered in whatever script it arrives in. */}
        {content.description ? <Text style={[styles.description, textAlignForContent(content.description, locale)]}>{content.description}</Text> : null}
        {event.priceNote ? <Section title={t('place.cost')} body={event.priceNote} /> : null}

        {/* --- NestUp social layer -------------------------------------
            Deliberately ABOVE external registration and visually separated
            from it. A parent must never confuse "other NestUp parents know
            I'm coming" with "I hold a place with the organizer". */}
        <RenderGuard resetKey={`attendance:${event.occurrence.id}`}>
          {attendanceSummary ? (
            <View style={styles.attendanceBlock}>
            <Text style={styles.sectionTitle}>{t('event.attendance.title')}</Text>
            <Pressable
              onPress={() => setShowAttendees(true)}
              accessibilityRole="button"
              accessibilityLabel={t('event.attendance.openList', { count: attendeeCount })}
              style={styles.attendanceTap}
            >
            <Text style={styles.attendanceCount}>{t(attendanceSummary.key, attendanceSummary.params)}</Text>
            <View style={styles.avatarRow} pointerEvents="none">
              {preview.shown.map((attendee) => (
                <View key={attendee.userId} style={styles.avatarTap}>
                  <PersonCard size="compact" name={attendee.displayName} avatarUrl={attendee.avatarUrl} />
                </View>
              ))}
              {preview.overflow > 0 ? (
                <Text style={styles.overflow}>{t('event.attendance.overflow', { count: preview.overflow })}</Text>
              ) : null}
            </View>
            </Pressable>
            </View>
          ) : null}

          <Pressable
            style={[styles.rsvp, rsvp.selected && styles.rsvpSelected, !rsvp.enabled && styles.rsvpDisabled]}
            onPress={() => void toggle()}
            disabled={!rsvp.enabled || isSaving}
            accessibilityRole="button"
            accessibilityState={{ selected: rsvp.selected, disabled: !rsvp.enabled || isSaving }}
            accessibilityLabel={t(rsvp.key)}
          >
            {rsvp.selected ? <Check size={18} color={theme.text.inverse} weight="bold" /> : null}
            <Text style={[styles.rsvpText, rsvp.selected && styles.rsvpTextSelected]}>{t(rsvp.key)}</Text>
          </Pressable>
          {/* States plainly that this is not organizer registration. */}
          {rsvp.enabled ? <Text style={styles.rsvpNote}>{t('event.rsvp.disclaimer')}</Text> : null}
        </RenderGuard>

        {/* --- External registration, a separate action ------------------ */}
        {content.registrationLabel && content.registrationUrl ? <ExternalLink label={content.registrationLabel} url={content.registrationUrl} /> : null}
        {content.sourceLabel ? <View style={styles.source}><Text style={styles.sourceText}>{content.sourceLabel}</Text>{content.sourceUrl ? <ExternalLink label={t('event.viewSource')} url={content.sourceUrl} /> : null}</View> : null}
      </ScrollView>
      {showCalendar ? (
        <RenderGuard resetKey={`calendar:${event.occurrence.id}`}>
          <AddEventToCalendarSheet visible event={calendarEvent} onDismiss={() => setShowCalendar(false)} />
        </RenderGuard>
      ) : null}
      {showAttendees ? (
        <RenderGuard resetKey={`attendees:${event.occurrence.id}`}>
          <EventAttendeesSheet visible attendees={attendees} onDismiss={() => setShowAttendees(false)} onOpenProfile={onOpenProfile} />
        </RenderGuard>
      ) : null}
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
  return <Pressable accessibilityRole="link" style={styles.linkRow} onPress={() => { void Linking.openURL(url).catch(() => undefined); }}><ArrowSquareOut size={18} color={theme.brand.primary} /><Text style={styles.link}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background.app },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
  back: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background.surface },
  // Directional icons only — never applied to map pins or category glyphs.
  flipped: { transform: [{ scaleX: -1 }] },
  attendanceBlock: { paddingVertical: spacing.sm, gap: spacing.xs },
  attendanceCount: { ...typography.subhead, color: theme.text.secondary },
  attendanceTap: { minHeight: 44, justifyContent: 'center' },
  // Wraps rather than scrolls, so a long attendee list cannot push the row
  // off a small screen.
  avatarRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  avatarTap: { minHeight: 44, justifyContent: 'center' },
  overflow: { ...typography.subhead, color: theme.text.muted, marginStart: spacing.xs },
  rsvp: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: theme.brand.primary,
    backgroundColor: theme.background.surface,
    marginTop: spacing.sm,
  },
  rsvpSelected: { backgroundColor: theme.brand.primary },
  rsvpDisabled: { opacity: 0.5, borderColor: theme.border.default },
  rsvpText: { ...typography.bodyMedium, color: theme.brand.primary, fontWeight: '600' },
  rsvpTextSelected: { color: theme.text.inverse },
  rsvpNote: { ...typography.caption, color: theme.text.muted, marginTop: spacing.xs, textAlign: 'center' },
  headerTitle: { ...typography.headline, color: theme.text.primary },
  failSafeContent: { flex: 1, padding: spacing.lg },
  content: { paddingHorizontal: spacing.lg, paddingBottom: 48, gap: spacing.md },
  // A raw 4:3 with no screen-height cap is 38% of an iPhone SE. maxHeight
  // applies the same ceiling CoverFrame gives the Activity hero, so all three
  // detail screens bound their hero identically.
  hero: {
    width: '100%',
    aspectRatio: 4 / 3,
    maxHeight: HERO_MAX,
    borderRadius: radius.lg,
    backgroundColor: theme.background.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
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
