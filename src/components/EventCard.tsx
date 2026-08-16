import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarDots, Repeat } from 'phosphor-react-native';
import { ContentImage } from '@/components/ContentImage';
import { radius, spacing, theme, typography } from '@/theme';
import type { EventDetails } from '@/types/event';
import { buildEventDetailsPresentation } from '@/utils/eventPresentation';
import { attendanceCardKey } from '@/utils/eventAttendance';
import { CARD_MEDIA_MAX_HEIGHT } from '@/constants/activityArtFrame';
import { dateLocaleTag, textAlignForContent, useI18n } from '@/i18n';

export function EventCard({ event, highlighted, compact = false, attendeeCount = 0, onPress }: {
  event: EventDetails;
  highlighted?: boolean;
  compact?: boolean;
  /** NestUp RSVP count. A plain number, supplied by the list — cards never
   *  fetch attendee profiles. */
  attendeeCount?: number;
  onPress: (event: EventDetails) => void;
}) {
  const { t, locale } = useI18n();
  const content = buildEventDetailsPresentation(event, dateLocaleTag(locale));
  const attendance = attendanceCardKey(attendeeCount);
  const interrupted = event.lifecycle === 'cancelled' || event.lifecycle === 'postponed';
  return <Pressable accessibilityRole="button" accessibilityLabel={`${content.title}, ${content.lifecycleLabel}`} onPress={() => onPress(event)} style={({ pressed }) => [styles.card, compact && styles.compact, highlighted && styles.highlighted, pressed && styles.pressed]}>
    <ContentImage asset={event.images?.card ?? event.images?.cover} legacyUri={event.imageUrl} variant="card" style={styles.image} accessibilityLabel={`${content.title} event image`} fallback={<CalendarDots size={28} color={theme.brand.primary} weight="duotone" />} />
    <View style={styles.body}>
      <View style={styles.topRow}><Text style={styles.category}>{content.categoryLabel}</Text><View style={[styles.badge, interrupted && styles.badgeInterrupted]}><Text style={[styles.badgeText, interrupted && styles.badgeTextInterrupted]}>{content.lifecycleLabel}</Text></View></View>
      <Text style={[styles.title, textAlignForContent(content.title, locale)]} numberOfLines={2}>{content.title}</Text>
      <Text style={styles.meta} numberOfLines={1}>{content.dateLabel} · {content.timeLabel}</Text>
      <Text style={styles.meta} numberOfLines={1}>{content.locationName}</Text>
      {/* Secondary NestUp attendance signal. Absent at zero, and a plain
          count only — no attendee profiles are loaded for a card. It says
          "going", never the event's real municipal attendance. */}
      {attendance ? <Text style={styles.attendance} numberOfLines={1}>{t(attendance.key, attendance.params)}</Text> : null}
      {event.recurrence.isRecurring ? <View style={styles.recurring}><Repeat size={13} color={theme.text.muted} /><Text style={styles.recurringText}>{t('event.recurring')}</Text></View> : null}
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  // maxHeight matches PlaceCard and the shared card-media ceiling, so long
  // metadata or a recurring badge can never grow the row unboundedly.
  card: { flexDirection: 'row', minHeight: 126, maxHeight: CARD_MEDIA_MAX_HEIGHT, backgroundColor: theme.background.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border.default, overflow: 'hidden', marginBottom: spacing.sm },
  compact: { minHeight: 112 },
  // Secondary weight on purpose — it must not compete with the title.
  attendance: { ...typography.caption, color: theme.text.accent, marginTop: 2 },
  highlighted: { borderColor: theme.brand.accent, borderWidth: 1.5 },
  pressed: { opacity: 0.86 },
  image: { width: 112, alignSelf: 'stretch', backgroundColor: theme.brand.accentTint },
  body: { flex: 1, padding: spacing.md, justifyContent: 'center' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  category: { ...typography.caption, color: theme.brand.accent, textTransform: 'uppercase' },
  badge: { paddingHorizontal: spacing.xs, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: theme.brand.accentTint },
  badgeInterrupted: { backgroundColor: theme.semantic.dangerTint },
  badgeText: { ...typography.caption, color: theme.text.primary },
  badgeTextInterrupted: { color: theme.semantic.danger },
  title: { ...typography.subhead, fontWeight: '700', color: theme.text.primary, marginTop: 3 },
  meta: { ...typography.footnote, color: theme.text.secondary, marginTop: 2 },
  recurring: { flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 4 },
  recurringText: { ...typography.caption, color: theme.text.muted },
});
