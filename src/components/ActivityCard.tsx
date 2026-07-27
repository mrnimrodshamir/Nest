import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { theme, typography, spacing, radius, pressFeedback } from '@/theme';
import type { Activity } from '@/types/activity';
import { CATEGORY_LABELS } from '@/types/activity';
import { CoverImage } from '@/components/CoverImage';
import { formatStartTime } from '@/utils/formatStartTime';

interface ActivityCardProps {
  activity: Activity;
  onPress: (activity: Activity) => void;
  /** 'feed' = full-width vertical card, 'rail' = compact horizontal card */
  variant?: 'feed' | 'rail';
  /** true when this activity's map pin is currently selected */
  highlighted?: boolean;
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function ActivityCard({
  activity,
  onPress,
  variant = 'feed',
  highlighted = false,
}: ActivityCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(pressFeedback.scale, pressFeedback.spring);
  };
  const handlePressOut = () => {
    scale.value = withSpring(1, pressFeedback.spring);
  };

  const isRail = variant === 'rail';
  const visibleAttendees = activity.attendees.slice(0, 3);
  const overflowCount = Math.max(
    0,
    activity.attendeeCount - visibleAttendees.length,
  );

  return (
    <AnimatedPressable
      onPress={() => onPress(activity)}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        styles.card,
        isRail ? styles.cardRail : styles.cardFeed,
        highlighted && styles.cardHighlighted,
        animatedStyle,
      ]}
      accessibilityRole="button"
      accessibilityLabel={`${activity.title}, ${formatStartTime(activity.startTime)}`}
    >
      <View style={[styles.image, isRail ? styles.imageRail : styles.imageFeed]}>
        <CoverImage
          url={activity.coverImageUrl}
          fallbackCategory={activity.category}
          style={StyleSheet.absoluteFill}
        />
      </View>

      <View style={styles.body}>
        {!isRail && (
          <View style={styles.pillRow}>
            <View style={styles.categoryPill}>
              <Text style={styles.categoryPillText}>
                {CATEGORY_LABELS[activity.category]}
              </Text>
            </View>
            {activity.status === 'full' && (
              <View style={[styles.categoryPill, styles.fullPill]}>
                <Text style={[styles.categoryPillText, styles.fullPillText]}>Full</Text>
              </View>
            )}
          </View>
        )}

        <Text
          style={isRail ? styles.titleRail : styles.titleFeed}
          numberOfLines={isRail ? 2 : 1}
        >
          {activity.title}
        </Text>

        <Text style={styles.meta}>
          {formatStartTime(activity.startTime)}
          {!isRail && ` · ${activity.distanceMiles.toFixed(1)}mi away`}
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
                  <Image
                    source={{ uri: attendee.avatarUrl }}
                    style={StyleSheet.absoluteFill}
                    resizeMode="cover"
                  />
                )}
              </View>
            ))}
            <Text style={styles.attendeeCount}>
              {overflowCount > 0
                ? `+${overflowCount} more going`
                : `${activity.attendeeCount} going`}
            </Text>
          </View>
        )}
      </View>
    </AnimatedPressable>
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
    borderRadius: radius.xl,
    marginBottom: spacing.md,
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
  image: {
    backgroundColor: theme.brand.accentTint,
  },
  imageFeed: {
    height: 130,
  },
  imageRail: {
    height: 80,
  },
  body: {
    padding: spacing.md,
  },
  pillRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  categoryPill: {
    alignSelf: 'flex-start',
    backgroundColor: theme.brand.primaryTint,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  categoryPillText: {
    ...typography.caption,
    color: theme.text.accent,
  },
  fullPill: { backgroundColor: theme.brand.secondaryTint },
  fullPillText: { color: theme.brand.secondary },
  titleFeed: {
    ...typography.headline,
    color: theme.text.primary,
    marginBottom: 4,
  },
  titleRail: {
    ...typography.subhead,
    fontWeight: '600' as const,
    color: theme.text.primary,
    marginBottom: 4,
  },
  meta: {
    ...typography.footnote,
    color: theme.text.secondary,
  },
  attendeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  avatar: {
    width: 24,
    height: 24,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: theme.background.surface,
    overflow: 'hidden',
  },
  attendeeCount: {
    ...typography.caption,
    color: theme.text.secondary,
    marginLeft: spacing.sm,
  },
});
