import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { CalendarDots, Repeat } from 'phosphor-react-native';
import { radius, spacing, theme, typography } from '@/theme';
import type { EventDetails } from '@/types/event';
import { buildEventDetailsPresentation } from '@/utils/eventPresentation';

export function EventCard({ event, highlighted, compact = false, onPress }: {
  event: EventDetails;
  highlighted?: boolean;
  compact?: boolean;
  onPress: (event: EventDetails) => void;
}) {
  const content = buildEventDetailsPresentation(event);
  const interrupted = event.lifecycle === 'cancelled' || event.lifecycle === 'postponed';
  return <Pressable accessibilityRole="button" accessibilityLabel={`${event.title}, ${content.lifecycleLabel}`} onPress={() => onPress(event)} style={({ pressed }) => [styles.card, compact && styles.compact, highlighted && styles.highlighted, pressed && styles.pressed]}>
    {event.imageUrl ? <Image source={{ uri: event.imageUrl }} style={styles.image} resizeMode="cover" /> : <View style={styles.fallback}><CalendarDots size={28} color={theme.brand.primary} weight="duotone" /></View>}
    <View style={styles.body}>
      <View style={styles.topRow}><Text style={styles.category}>{content.categoryLabel}</Text><View style={[styles.badge, interrupted && styles.badgeInterrupted]}><Text style={[styles.badgeText, interrupted && styles.badgeTextInterrupted]}>{content.lifecycleLabel}</Text></View></View>
      <Text style={styles.title} numberOfLines={2}>{event.title}</Text>
      <Text style={styles.meta} numberOfLines={1}>{content.dateLabel} · {content.timeLabel}</Text>
      <Text style={styles.meta} numberOfLines={1}>{content.locationName}</Text>
      {event.recurrence.isRecurring ? <View style={styles.recurring}><Repeat size={13} color={theme.text.muted} /><Text style={styles.recurringText}>Recurring</Text></View> : null}
    </View>
  </Pressable>;
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', minHeight: 126, backgroundColor: theme.background.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border.default, overflow: 'hidden', marginBottom: spacing.sm },
  compact: { minHeight: 112 },
  highlighted: { borderColor: theme.brand.accent, borderWidth: 1.5 },
  pressed: { opacity: 0.86 },
  image: { width: 112, alignSelf: 'stretch', backgroundColor: theme.background.surfaceAlt },
  fallback: { width: 112, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.brand.accentTint },
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
