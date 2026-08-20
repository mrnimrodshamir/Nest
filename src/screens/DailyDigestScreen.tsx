import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, CalendarBlank, WarningCircle } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { EventCard } from '@/components/EventCard';
import { StateCard } from '@/components/StateCard';
import { SkeletonCard } from '@/components/SkeletonCard';
import { queryDailyDigestEvents } from '@/lib/events';
import { useI18n } from '@/i18n';
import { activeDateLocale } from '@/i18n/core';
import { track } from '@/lib/analytics';
import type { EventDetails } from '@/types/event';
import { isDailyDigestDateAvailable } from '@/utils/dailyDigestNotification';
import { buildEventDetailsPresentation } from '@/utils/eventPresentation';
import { formatAgeRange } from '@/utils/babyAge';
import { dateLocaleTag } from '@/i18n';

interface DailyDigestScreenProps {
  requestedDate?: string;
  onClose: () => void;
  onOpenEvent: (occurrenceId: string) => void;
}

/** Full-screen digest surface reached by tapping the "What's on today" push
 *  — never a dead end: an explicit X always returns to Discovery/Home
 *  (via onClose), and this screen re-derives the SAME deterministic
 *  selection the push used rather than reading a private analytics table.
 *  See queryDailyDigestEvents' doc comment. */
export function DailyDigestScreen({ requestedDate, onClose, onOpenEvent }: DailyDigestScreenProps) {
  const { t, isRTL, locale } = useI18n();
  const [events, setEvents] = useState<EventDetails[] | null>(null);
  const [error, setError] = useState(false);
  const isAvailable = isDailyDigestDateAvailable(requestedDate);

  const load = useCallback(async () => {
    if (!isAvailable) return;
    setError(false);
    try {
      const result = await queryDailyDigestEvents();
      setEvents(result);
    } catch {
      setError(true);
    }
  }, [isAvailable]);

  useEffect(() => {
    if (!isAvailable) {
      onClose();
    }
  }, [isAvailable, onClose]);

  useEffect(() => {
    if (!isAvailable) return;
    track('daily_digest_viewed', { locale });
    void load();
  }, [isAvailable, load, locale]);

  const dateLabel = new Date().toLocaleDateString(activeDateLocale(), { weekday: 'long', month: 'long', day: 'numeric' });

  const handleClose = useCallback(() => {
    track('daily_digest_closed', { event_count: events?.length ?? 0 });
    onClose();
  }, [events, onClose]);

  const handleOpenEvent = useCallback((event: EventDetails, position: number) => {
    track('daily_digest_event_opened', { occurrence_id: event.occurrence.id, provider: event.source.provider, position, locale });
    onOpenEvent(event.occurrence.id);
  }, [locale, onOpenEvent]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.headerTextColumn}>
          <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>{t('dailyDigest.title')}</Text>
          <Text style={[styles.headerDate, isRTL && styles.rtlText]}>{dateLabel}</Text>
        </View>
        <Pressable
          onPress={handleClose}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel={t('common.close', { what: t('dailyDigest.title') })}
        >
          <X size={20} color={theme.text.primary} />
        </Pressable>
      </View>

      {events === null && !error ? (
        <View style={styles.listContent}>
          <SkeletonCard />
          <SkeletonCard />
        </View>
      ) : error ? (
        <View style={styles.listContent}>
          <StateCard icon={WarningCircle} title={t('dailyDigest.loadError')} body="" ctaLabel={t('discovery.retry')} onCtaPress={load} tone="warning" />
        </View>
      ) : (events as EventDetails[]).length === 0 ? (
        <View style={styles.listContent}>
          <StateCard icon={CalendarBlank} title={t('dailyDigest.empty')} body="" />
        </View>
      ) : (
        <FlatList
          data={events as EventDetails[]}
          keyExtractor={(event) => event.occurrence.id}
          contentContainerStyle={styles.listContent}
          renderItem={({ item, index }) => {
            const presentation = buildEventDetailsPresentation(item, dateLocaleTag(locale), t);
            const sourceLabel = presentation.sourceLabel ?? (item.source.provider === 'tel_aviv_digitel'
              ? t('dailyDigest.municipalSource')
              : t('dailyDigest.officialSource'));
            const hasAge = item.ageMinMonths !== null || item.ageMaxMonths !== null;
            return (
              <View>
                <EventCard event={item} onPress={() => handleOpenEvent(item, index)} />
                <View style={styles.eventFacts}>
                  {hasAge ? <Text style={[styles.eventFact, isRTL && styles.rtlText]}>{t('dailyDigest.age', { age: formatAgeRange(item.ageMinMonths, item.ageMaxMonths) })}</Text> : null}
                  {item.priceNote ? <Text style={[styles.eventFact, isRTL && styles.rtlText]}>{t('dailyDigest.price', { price: item.priceNote })}</Text> : null}
                  <Text style={[styles.eventSource, isRTL && styles.rtlText]}>{sourceLabel}</Text>
                </View>
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background.app },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
  },
  headerTextColumn: { flex: 1, gap: 2 },
  headerTitle: { ...typography.title2, color: theme.text.primary },
  headerDate: { ...typography.footnote, color: theme.text.secondary },
  rtlText: { textAlign: 'right' },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.background.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border.default,
  },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  eventFacts: { marginTop: -spacing.sm, marginBottom: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, gap: 2 },
  eventFact: { ...typography.caption, color: theme.text.secondary },
  eventSource: { ...typography.caption, color: theme.text.muted },
});
