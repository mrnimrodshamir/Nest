import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { theme, typography, spacing, radius } from '@/theme';
import type { Activity } from '@/types/activity';
import { CoverImage } from '@/components/CoverImage';
import { CoverFrame } from '@/components/CoverFrame';
import { formatExactStartTime } from '@/utils/formatExactStartTime';
import { resolveBadges, type ActivityRelationship } from '@/utils/activityLifecycle';
import { activityCapacityPresentation } from '@/utils/activityCapacity';
import { activityCategoryLabel, textAlignForContent, useI18n } from '@/i18n';

interface ActivityCardProps {
  activity: Activity;
  onPress: (activity: Activity) => void;
  /** 'feed' = full-width vertical card, 'rail' = compact horizontal card */
  variant?: 'feed' | 'rail';
  /** true when this activity's map pin is currently selected */
  highlighted?: boolean;
  /** Distance from "you" isn't meaningful on lists of your own activities
   *  (My Activities) — hide it there instead of showing a misleading 0km. */
  hideDistance?: boolean;
  /** Viewer relationship is separate from lifecycle. Discovery omits it;
   * My Activities supplies Hosting or Joined. */
  relationship?: ActivityRelationship;
}

/** No Reanimated here — this renders inside a BottomSheetFlatList, and a
 *  shared-value-driven press/entrance animation on a list item scrolling
 *  inside a bottom sheet is exactly the class of Reanimated + native-layout
 *  interaction that caused this session's other crashes. Pressable's own
 *  native opacity feedback is enough. */
export function ActivityCard({
  activity,
  onPress,
  variant = 'feed',
  highlighted = false,
  hideDistance = false,
  relationship = 'none',
}: ActivityCardProps) {
  const isRail = variant === 'rail';
  const { t, locale } = useI18n();
  // Relationship is the viewer's own state, which outranks the raw count.
  const capacity = activityCapacityPresentation({
    capacity: activity.capacity,
    attendeeCount: activity.attendeeCount,
    isAttending: relationship === 'joined',
    isHost: relationship === 'hosting',
  });
  const visibleAttendees = activity.attendees.slice(0, 3);
  const overflowCount = Math.max(0, activity.attendeeCount - visibleAttendees.length);
  const badges = resolveBadges(activity, relationship);

  return (
    <Pressable
      onPress={() => onPress(activity)}
      style={({ pressed }) => [
        styles.card,
        isRail ? styles.cardRail : styles.cardFeed,
        highlighted && styles.cardHighlighted,
        pressed && styles.cardPressed,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${activity.title}, ${formatExactStartTime(activity.startTime)}`}
    >
      <CoverFrame variant="card" style={styles.image}>
        <CoverImage
          url={activity.coverImageUrl}
          fallbackCategory={activity.category}
          variant="card"
          surface="DiscoveryCard"
          style={StyleSheet.absoluteFill}
        />
        {!isRail && (
          <>
            <View style={styles.pillRow}>
              <View style={styles.categoryPill}>
                <Text style={styles.categoryPillText} numberOfLines={1}>
                  {activityCategoryLabel(activity.category, t)}
                </Text>
              </View>
              {badges.lifecycle && (
                <View style={[styles.categoryPill, styles.lifecyclePill]}>
                  <Text style={[styles.categoryPillText, styles.lifecyclePillText]}>{badges.lifecycle}</Text>
                </View>
              )}
            </View>
            {badges.relationship && (
              <View style={styles.relationshipPill}>
                <Text style={styles.relationshipPillText}>{badges.relationship}</Text>
              </View>
            )}
          </>
        )}
      </CoverFrame>

      <View style={styles.body}>
        <Text style={[isRail ? styles.titleRail : styles.titleFeed, textAlignForContent(activity.title, locale)]} numberOfLines={isRail ? 2 : 1}>
          {activity.title}
        </Text>

        <View style={styles.metaRow}>
          <Text style={styles.meta} numberOfLines={1}>
            {formatExactStartTime(activity.startTime)}
            {!isRail && !hideDistance && ` · ${activity.distanceKm.toFixed(1)}km`}
          </Text>

          {!isRail && activity.attendeeCount > 0 && (
            <View style={styles.attendeeRow}>
              {visibleAttendees.map((attendee, index) => (
                <View
                  key={attendee.id}
                  style={[
                    styles.avatar,
                    { backgroundColor: attendee.avatarColor, marginStart: index === 0 ? 0 : -8 },
                  ]}
                >
                  {attendee.avatarUrl && (
                    <Image source={{ uri: attendee.avatarUrl }} style={StyleSheet.absoluteFill} resizeMode="cover" />
                  )}
                </View>
              ))}
              <Text style={styles.attendeeCount}>
                {overflowCount > 0 ? `+${overflowCount}` : activity.attendeeCount}
              </Text>
            </View>
          )}
        </View>

        {/* Capacity state, rail excluded — a 150pt rail card has no room and
            the feed/detail surfaces already carry it. Renders nothing when the
            host configured no capacity. */}
        {!isRail && capacity.key ? (
          <Text
            style={[styles.capacity, capacity.tone === 'urgent' && styles.capacityUrgent, capacity.tone === 'full' && styles.capacityFull]}
            numberOfLines={1}
          >
            {t(capacity.key, capacity.params)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.background.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border.default,
    overflow: 'hidden',
  },
  cardFeed: {
    width: '100%',
    borderRadius: radius.lg,
    marginBottom: spacing.sm,
  },
  cardRail: {
    width: 150,
    borderRadius: radius.lg,
    marginEnd: spacing.sm,
  },
  cardHighlighted: {
    borderColor: theme.brand.primary,
    borderWidth: 1.5,
  },
  cardPressed: { opacity: 0.85 },
  capacity: { ...typography.caption, color: theme.text.secondary, marginTop: 2 },
  capacityUrgent: { color: theme.semantic.warning, fontWeight: '600' },
  capacityFull: { color: theme.text.muted, fontWeight: '600' },
  // Background + inner padding for the badge row only. The 16:9 ratio and
  // clipping now come from CoverFrame, so feed and rail can no longer drift
  // to different proportions (rail previously used 4:3, which is hero
  // shape on a card surface).
  image: {
    backgroundColor: theme.brand.accentTint,
    justifyContent: 'flex-start',
    padding: spacing.sm,
  },
  // Capped so an unusually long category label can never grow into the
  // opposite (top-right) corner, where MyActivitiesScreen's separate
  // hosting/attendee badge is absolutely positioned.
  pillRow: { flexDirection: 'row', gap: spacing.xs, alignSelf: 'flex-start', maxWidth: '55%' },
  categoryPill: {
    backgroundColor: 'rgba(254,253,251,0.92)',
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  categoryPillText: {
    ...typography.caption,
    color: theme.text.accent,
  },
  lifecyclePill: { backgroundColor: theme.brand.secondaryTint },
  lifecyclePillText: { color: theme.brand.secondary },
  relationshipPill: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: theme.brand.primaryTint,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
  },
  relationshipPillText: { ...typography.caption, color: theme.brand.primaryPressed },
  body: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  titleFeed: {
    ...typography.subhead,
    fontWeight: '600' as const,
    color: theme.text.primary,
    marginBottom: 2,
  },
  titleRail: {
    ...typography.subhead,
    fontWeight: '600' as const,
    color: theme.text.primary,
    marginBottom: 4,
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meta: {
    ...typography.footnote,
    color: theme.text.secondary,
    flexShrink: 1,
  },
  attendeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginStart: spacing.sm,
  },
  avatar: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    borderColor: theme.background.surface,
    overflow: 'hidden',
  },
  attendeeCount: {
    ...typography.caption,
    color: theme.text.secondary,
    marginStart: 4,
  },
});
