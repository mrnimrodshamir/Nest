import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, SectionList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, CalendarBlank } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { EventCard } from '@/components/EventCard';
import { StateCard } from '@/components/StateCard';
import { SkeletonCard } from '@/components/SkeletonCard';
import { queryWeeklyDigestEvents, type WeeklyDigestDayEvents } from '@/lib/events';
import { useI18n, dateLocaleTag } from '@/i18n';
import { track } from '@/lib/analytics';
import type { EventDetails } from '@/types/event';
import { isWeeklyDigestWeekAvailable } from '@/utils/dailyDigestNotification';
import { formatAgeRange } from '@/utils/babyAge';

interface WeeklyDigestScreenProps {
  requestedWeekStart?: string;
  requestedOccurrenceIds?: readonly string[];
  onClose: () => void;
  onOpenEvent: (occurrenceId: string) => void;
}

const EMPTY_OCCURRENCE_IDS: readonly string[] = [];

export function WeeklyDigestScreen({ requestedWeekStart, requestedOccurrenceIds = EMPTY_OCCURRENCE_IDS, onClose, onOpenEvent }: WeeklyDigestScreenProps) {
  const { t, isRTL, locale } = useI18n();
  const [days, setDays] = useState<WeeklyDigestDayEvents[] | null>(null);
  const isAvailable = isWeeklyDigestWeekAvailable(requestedWeekStart);
  const viewedKeyRef = useRef<string | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const load = useCallback(async () => {
    if (!isAvailable) return;
    try {
      setDays(await queryWeeklyDigestEvents(new Date(), requestedOccurrenceIds));
    } catch {
      onCloseRef.current();
    }
  }, [isAvailable, requestedOccurrenceIds]);

  useEffect(() => {
    if (!isAvailable) onCloseRef.current();
  }, [isAvailable]);

  useEffect(() => {
    if (!isAvailable) return;
    if (viewedKeyRef.current !== requestedWeekStart) {
      viewedKeyRef.current = requestedWeekStart ?? null;
      track('weekly_digest_viewed', { week_start: requestedWeekStart, city: 'tel_aviv', locale });
    }
    void load();
  }, [isAvailable, load, locale, requestedWeekStart]);

  const sections = useMemo(() => (days ?? []).map((day) => ({
    title: formatDayHeading(day.localDate, dateLocaleTag(locale)),
    localDate: day.localDate,
    data: day.events.length ? day.events : [null],
  })), [days, locale]);
  const eventCount = days?.reduce((total, day) => total + day.events.length, 0) ?? 0;

  const handleClose = useCallback(() => {
    track('weekly_digest_closed', { week_start: requestedWeekStart, city: 'tel_aviv', result_count: eventCount });
    onClose();
  }, [eventCount, onClose, requestedWeekStart]);

  const handleOpenEvent = useCallback((event: EventDetails, day: string, position: number) => {
    track('weekly_digest_event_opened', {
      week_start: requestedWeekStart,
      city: 'tel_aviv',
      locale,
      day,
      occurrence_id: event.occurrence.id,
      provider: event.source.provider,
      category: event.category,
      position,
    });
    onOpenEvent(event.occurrence.id);
  }, [locale, onOpenEvent, requestedWeekStart]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>{t('weeklyDigest.title')}</Text>
        <Pressable
          onPress={handleClose}
          style={styles.closeButton}
          accessibilityRole="button"
          accessibilityLabel={t('common.close', { what: t('weeklyDigest.title') })}
        >
          <X size={20} color={theme.text.primary} />
        </Pressable>
      </View>

      {days === null ? (
        <View style={styles.content}><SkeletonCard /><SkeletonCard /></View>
      ) : eventCount === 0 ? (
        <View style={styles.content}><StateCard icon={CalendarBlank} title={t('weeklyDigest.empty')} body="" /></View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => item?.occurrence.id ?? `empty-${index}`}
          contentContainerStyle={styles.content}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => (
            <Text style={[styles.dayHeading, isRTL && styles.rtlText]}>{section.title}</Text>
          )}
          renderItem={({ item, index, section }) => item ? (
            <View>
              <EventCard event={item} onPress={() => handleOpenEvent(item, section.localDate, index)} />
              <View style={styles.eventFacts}>
                {(item.ageMinMonths !== null || item.ageMaxMonths !== null) ? (
                  <Text style={[styles.eventFact, isRTL && styles.rtlText]}>{t('dailyDigest.age', { age: formatAgeRange(item.ageMinMonths, item.ageMaxMonths) })}</Text>
                ) : null}
                {item.priceNote ? <Text style={[styles.eventFact, isRTL && styles.rtlText]}>{t('dailyDigest.price', { price: item.priceNote })}</Text> : null}
              </View>
            </View>
          ) : (
            <Text style={[styles.dayEmpty, isRTL && styles.rtlText]}>{t('weeklyDigest.dayEmpty')}</Text>
          )}
        />
      )}
    </SafeAreaView>
  );
}

function formatDayHeading(localDate: string, locale: string): string {
  const [year, month, day] = localDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(locale, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background.app },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm },
  headerTitle: { ...typography.title2, color: theme.text.primary, flex: 1 },
  rtlText: { textAlign: 'right' },
  closeButton: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border.default },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  dayHeading: { ...typography.title3, color: theme.text.primary, marginTop: spacing.md, marginBottom: spacing.xs },
  dayEmpty: { ...typography.body, color: theme.text.muted, paddingVertical: spacing.md },
  eventFacts: { marginTop: -spacing.sm, marginBottom: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, gap: 2 },
  eventFact: { ...typography.caption, color: theme.text.secondary },
});
