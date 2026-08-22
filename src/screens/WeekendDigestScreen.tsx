import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, SectionList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { X, CalendarBlank } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { EventCard } from '@/components/EventCard';
import { StateCard } from '@/components/StateCard';
import { SkeletonCard } from '@/components/SkeletonCard';
import { queryWeekendDigestEvents, type WeekendDigestSectionEvents } from '@/lib/events';
import { useI18n, type TranslationKey } from '@/i18n';
import { track } from '@/lib/analytics';
import type { EventDetails } from '@/types/event';
import { isWeekendDigestAvailable } from '@/utils/dailyDigestNotification';
import { formatAgeRange } from '@/utils/babyAge';

interface WeekendDigestScreenProps {
  requestedWeekendStart?: string;
  requestedOccurrenceIds?: readonly string[];
  onClose: () => void;
  onOpenEvent: (occurrenceId: string) => void;
}

const EMPTY_OCCURRENCE_IDS: readonly string[] = [];
const SECTION_KEYS: Record<WeekendDigestSectionEvents['key'], TranslationKey> = {
  thursday_evening: 'weekendDigest.thursdayEvening',
  friday: 'weekendDigest.friday',
  saturday: 'weekendDigest.saturday',
};

export function WeekendDigestScreen({ requestedWeekendStart, requestedOccurrenceIds = EMPTY_OCCURRENCE_IDS, onClose, onOpenEvent }: WeekendDigestScreenProps) {
  const { t, isRTL, locale } = useI18n();
  const [sectionsData, setSectionsData] = useState<WeekendDigestSectionEvents[] | null>(null);
  const isAvailable = isWeekendDigestAvailable(requestedWeekendStart);
  const viewedKeyRef = useRef<string | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const load = useCallback(async () => {
    if (!isAvailable || !requestedWeekendStart) return;
    try {
      setSectionsData(await queryWeekendDigestEvents(requestedWeekendStart, new Date(), requestedOccurrenceIds));
    } catch {
      onCloseRef.current();
    }
  }, [isAvailable, requestedOccurrenceIds, requestedWeekendStart]);

  useEffect(() => {
    if (!isAvailable) onCloseRef.current();
  }, [isAvailable]);

  useEffect(() => {
    if (!isAvailable) return;
    if (viewedKeyRef.current !== requestedWeekendStart) {
      viewedKeyRef.current = requestedWeekendStart ?? null;
      track('weekend_digest_viewed', { weekend_start: requestedWeekendStart, city: 'tel_aviv', locale });
    }
    void load();
  }, [isAvailable, load, locale, requestedWeekendStart]);

  const sections = useMemo(() => (sectionsData ?? []).map((section) => ({
    title: t(SECTION_KEYS[section.key]), key: section.key, localDate: section.localDate,
    data: section.events.length ? section.events : [null],
  })), [sectionsData, t]);
  const eventCount = sectionsData?.reduce((total, section) => total + section.events.length, 0) ?? 0;

  const handleClose = useCallback(() => {
    track('weekend_digest_closed', { weekend_start: requestedWeekendStart, city: 'tel_aviv', result_count: eventCount });
    onClose();
  }, [eventCount, onClose, requestedWeekendStart]);

  const handleOpenEvent = useCallback((event: EventDetails, section: WeekendDigestSectionEvents['key'], position: number) => {
    track('weekend_digest_event_opened', {
      weekend_start: requestedWeekendStart, city: 'tel_aviv', locale, section,
      occurrence_id: event.occurrence.id, provider: event.source.provider,
      category: event.category, position,
    });
    onOpenEvent(event.occurrence.id);
  }, [locale, onOpenEvent, requestedWeekendStart]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={[styles.headerTitle, isRTL && styles.rtlText]}>{t('weekendDigest.title')}</Text>
        <Pressable onPress={handleClose} style={styles.closeButton} accessibilityRole="button" accessibilityLabel={t('common.close', { what: t('weekendDigest.title') })}>
          <X size={20} color={theme.text.primary} />
        </Pressable>
      </View>
      {sectionsData === null ? (
        <View style={styles.content}><SkeletonCard /><SkeletonCard /></View>
      ) : eventCount === 0 ? (
        <View style={styles.content}><StateCard icon={CalendarBlank} title={t('weekendDigest.empty')} body="" /></View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item, index) => item?.occurrence.id ?? `empty-${index}`}
          contentContainerStyle={styles.content}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) => <Text style={[styles.sectionHeading, isRTL && styles.rtlText]}>{section.title}</Text>}
          renderItem={({ item, index, section }) => item ? (
            <View>
              <EventCard event={item} onPress={() => handleOpenEvent(item, section.key, index)} />
              <View style={styles.eventFacts}>
                {(item.ageMinMonths !== null || item.ageMaxMonths !== null) ? <Text style={[styles.eventFact, isRTL && styles.rtlText]}>{t('dailyDigest.age', { age: formatAgeRange(item.ageMinMonths, item.ageMaxMonths) })}</Text> : null}
                {item.priceNote ? <Text style={[styles.eventFact, isRTL && styles.rtlText]}>{t('dailyDigest.price', { price: item.priceNote })}</Text> : null}
              </View>
            </View>
          ) : <Text style={[styles.dayEmpty, isRTL && styles.rtlText]}>{t('weekendDigest.dayEmpty')}</Text>}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background.app },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm },
  headerTitle: { ...typography.title2, color: theme.text.primary, flex: 1 },
  rtlText: { textAlign: 'right' },
  closeButton: { width: 36, height: 36, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.background.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: theme.border.default },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.sm },
  sectionHeading: { ...typography.title3, color: theme.text.primary, marginTop: spacing.md, marginBottom: spacing.xs },
  dayEmpty: { ...typography.body, color: theme.text.muted, paddingVertical: spacing.md },
  eventFacts: { marginTop: -spacing.sm, marginBottom: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, gap: 2 },
  eventFact: { ...typography.caption, color: theme.text.secondary },
});
