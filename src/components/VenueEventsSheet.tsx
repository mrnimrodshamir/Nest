import React from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { X } from 'phosphor-react-native';
import { EventCard } from '@/components/EventCard';
import { radius, spacing, theme, typography } from '@/theme';
import type { EventDetails } from '@/types/event';
import type { EventVenueMapItem } from '@/utils/eventVenueGrouping';
import { formatAgeRange } from '@/utils/babyAge';
import { useI18n } from '@/i18n';

/** "{count} activities here" bottom sheet for a venue marker holding more
 *  than one Event. Tapping a row opens the normal Event Details screen;
 *  DiscoverScreen keeps this sheet's state alive underneath that navigation,
 *  so returning lands back on the venue list rather than the bare map.
 *
 *  Uses a FlatList (not the ScrollView the Filters/Sort modals use) because
 *  real Tel Aviv venues run up to ~34 Events (see the production data
 *  audit) — this keeps large venues cheap to render instead of mounting
 *  every EventCard's image/media up front. */
export function VenueEventsSheet({ group, attendeeCounts, onClose, onOpenEvent }: {
  group: Extract<EventVenueMapItem, { kind: 'venue' }> | null;
  attendeeCounts: Record<string, number>;
  onClose: () => void;
  onOpenEvent: (event: EventDetails) => void;
}) {
  const { t } = useI18n();
  const visible = group !== null;
  const title = group?.venueName
    ? t('discovery.venueSheetTitle', { venue: group.venueName })
    : t(group && group.events.length === 1 ? 'discovery.venueActivitiesCount.one' : 'discovery.venueActivitiesCount.other', { count: group?.events.length ?? 0 });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.overlay} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title} numberOfLines={2}>{title}</Text>
            <Pressable onPress={onClose} accessibilityLabel={t('common.close', { what: group?.venueName ?? t('discovery.events') })} hitSlop={10}>
              <X size={20} color={theme.text.primary} />
            </Pressable>
          </View>
          {group ? (
            <FlatList
              data={group.events}
              keyExtractor={(event) => event.occurrence.id}
              renderItem={({ item }) => {
                const hasAge = item.ageMinMonths !== null || item.ageMaxMonths !== null;
                return (
                  <View style={styles.row}>
                    <EventCard event={item} compact attendeeCount={attendeeCounts[item.occurrence.id] ?? 0} onPress={onOpenEvent} />
                    {/* Same supplementary-facts pattern DailyDigestScreen uses
                        below its own EventCard: age/price are not part of the
                        shared card, so a row that must show them (per the
                        venue-sheet requirement) adds them here rather than
                        changing EventCard for every screen that uses it. */}
                    {hasAge || item.priceNote ? (
                      <View style={styles.eventFacts}>
                        {hasAge ? <Text style={styles.eventFact}>{t('dailyDigest.age', { age: formatAgeRange(item.ageMinMonths, item.ageMaxMonths) })}</Text> : null}
                        {item.priceNote ? <Text style={styles.eventFact}>{t('dailyDigest.price', { price: item.priceNote })}</Text> : null}
                      </View>
                    ) : null}
                  </View>
                );
              }}
              contentContainerStyle={styles.listContent}
              initialNumToRender={8}
              maxToRenderPerBatch={10}
              windowSize={7}
              removeClippedSubviews
            />
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(43,43,40,0.4)' },
  sheet: { maxHeight: '78%', minHeight: '40%', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: theme.background.surface },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm, padding: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border.default },
  title: { flex: 1, ...typography.title3, color: theme.text.primary },
  listContent: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  row: { width: '100%' },
  eventFacts: { marginTop: -spacing.sm, marginBottom: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, gap: 2 },
  eventFact: { ...typography.caption, color: theme.text.secondary },
});
