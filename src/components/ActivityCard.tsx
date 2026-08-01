import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { theme, typography, spacing, radius } from '@/theme';
import type { Activity } from '@/types/activity';
import { CATEGORY_LABELS } from '@/types/activity';
import { CoverImage } from '@/components/CoverImage';
import { formatExactStartTime } from '@/utils/formatExactStartTime';

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
}: ActivityCardProps) {
  const isRail = variant === 'rail';
  const visibleAttendees = activity.attendees.slice(0, 3);
  const overflowCount = Math.max(0, activity.attendeeCount - visibleAttendees.length);

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
      <View style={[styles.image, isRail ? styles.imageRail : styles.imageFeed]}>
        <CoverImage
          url={activity.coverImageUrl}
          fallbackCategory={activity.category}
          variant="card"
          surface="DiscoveryCard"
          style={StyleSheet.absoluteFill}
        />
        {!isRail && (
          <View style={styles.pillRow}>
            <View style={styles.categoryPill}>
              <Text style={styles.categoryPillText} numberOfLines={1}>
                {CATEGORY_LABELS[activity.category] ?? CATEGORY_LABELS.other}
              </Text>
            </View>
            {activity.status === 'full' && (
              <View style={[styles.categoryPill, styles.fullPill]}>
                <Text style={[styles.categoryPillText, styles.fullPillText]}>Full</Text>
              </View>
            )}
          </View>
        )}
      </View>

      <View style={styles.body}>
        <Text style={isRail ? styles.titleRail : styles.titleFeed} numberOfLines={isRail ? 2 : 1}>
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
                    { backgroundColor: attendee.avatarColor, marginLeft: index === 0 ? 0 : -8 },
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
    marginRight: spacing.sm,
  },
  cardHighlighted: {
    borderColor: theme.brand.primary,
    borderWidth: 1.5,
  },
  cardPressed: { opacity: 0.85 },
  image: {
    backgroundColor: theme.brand.accentTint,
    justifyContent: 'flex-start',
  },
  imageFeed: {
    // A compact 16:9 banner, not the source's full 4:3 — a Discovery card
    // is a scannable list item, not a hero, so the image should support
    // the title/meta text below it rather than dominate the card. Still
    // wide enough that resizeMode "cover" only trims top/bottom, never
    // stretches or squeezes the source art.
    aspectRatio: 16 / 9,
    padding: spacing.sm,
  },
  imageRail: {
    aspectRatio: 4 / 3,
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
  fullPill: { backgroundColor: theme.brand.secondaryTint },
  fullPillText: { color: theme.brand.secondary },
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
    marginLeft: spacing.sm,
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
    marginLeft: 4,
  },
});
