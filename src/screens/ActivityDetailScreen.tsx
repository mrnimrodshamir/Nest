import React from 'react';
import { View, Text, Image, ScrollView, Pressable, StyleSheet, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import { ArrowLeft, DotsThree, SealCheck, NavigationArrow } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import type { ActivityDetail } from '@/types/activity';
import { CATEGORY_LABELS } from '@/types/activity';
import { formatStartTime } from '@/utils/formatStartTime';
import { formatDuration } from '@/utils/formatDuration';
import { formatAgeRange } from '@/utils/babyAge';
import { useActivityRsvp } from '@/hooks/useActivityRsvp';

interface ActivityDetailScreenProps {
  activity: ActivityDetail;
  onBack: () => void;
  onReport: () => void;
  onMessageHost: (hostId: string) => void;
  /** Called once the person successfully joins — screen can navigate to the group chat */
  onJoined: (activity: ActivityDetail) => void;
}

export function ActivityDetailScreen({
  activity: initial,
  onBack,
  onReport,
  onMessageHost,
  onJoined,
}: ActivityDetailScreenProps) {
  const { activity, isSubmitting, join, leave } = useActivityRsvp(initial);

  const isFull =
    activity.capacity !== null && activity.attendeeCount >= activity.capacity;
  const spotsLeft =
    activity.capacity !== null ? activity.capacity - activity.attendeeCount : null;

  const handleGetDirections = () => {
    const { latitude, longitude, label } = activity.location;
    const url = Platform.select({
      ios: `maps://?daddr=${latitude},${longitude}&q=${encodeURIComponent(label)}`,
      default: `https://maps.google.com/?daddr=${latitude},${longitude}`,
    });
    if (url) Linking.openURL(url);
  };

  const handleJoinPress = async () => {
    if (activity.viewerStatus === 'none') {
      await join();
      onJoined(activity);
    } else {
      await leave();
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          {activity.coverImageUrl && (
            <Image
              source={{ uri: activity.coverImageUrl }}
              style={StyleSheet.absoluteFill}
              resizeMode="cover"
            />
          )}
          <SafeAreaView edges={['top']} style={styles.heroOverlay}>
            <Pressable style={styles.roundButton} onPress={onBack} accessibilityLabel="Back">
              <ArrowLeft size={18} color={theme.text.primary} />
            </Pressable>
            <Pressable style={styles.roundButton} onPress={onReport} accessibilityLabel="More options">
              <DotsThree size={18} color={theme.text.primary} weight="bold" />
            </Pressable>
          </SafeAreaView>
        </View>

        <View style={styles.content}>
          <View style={styles.categoryPill}>
            <Text style={styles.categoryPillText}>
              {CATEGORY_LABELS[activity.category]}
            </Text>
          </View>
          <Text style={styles.title}>{activity.title}</Text>
          <Text style={styles.meta}>
            {formatStartTime(activity.startTime)} · {formatDuration(activity.durationMinutes)} ·{' '}
            {activity.distanceMiles.toFixed(1)}mi away
          </Text>
          <Text style={styles.meta}>
            Baby age: {formatAgeRange(activity.babyMinAgeMonths, activity.babyMaxAgeMonths)}
          </Text>

          <Pressable
            style={styles.hostRow}
            onPress={() => onMessageHost(activity.host.id)}
          >
            <View style={[styles.hostAvatar, { backgroundColor: activity.host.avatarColor }]}>
              {activity.host.avatarUrl && (
                <Image source={{ uri: activity.host.avatarUrl }} style={StyleSheet.absoluteFill} />
              )}
            </View>
            <View style={styles.hostInfo}>
              <View style={styles.hostNameRow}>
                <Text style={styles.hostName}>Hosted by {activity.host.displayName}</Text>
                {activity.host.verified && (
                  <SealCheck size={14} color={theme.brand.primary} weight="fill" />
                )}
              </View>
              {activity.host.bio && <Text style={styles.hostBio}>{activity.host.bio}</Text>}
            </View>
            <Text style={styles.messageLink}>Message</Text>
          </Pressable>

          <Text style={styles.sectionLabel}>About</Text>
          <Text style={styles.description}>{activity.description}</Text>

          {activity.notes && (
            <>
              <Text style={styles.sectionLabel}>What to bring</Text>
              <Text style={styles.description}>{activity.notes}</Text>
            </>
          )}

          <Text style={styles.sectionLabel}>Location</Text>
          <View style={styles.mapPlaceholder}>
            <MapView
              provider={PROVIDER_DEFAULT}
              style={StyleSheet.absoluteFill}
              scrollEnabled={false}
              zoomEnabled={false}
              pitchEnabled={false}
              rotateEnabled={false}
              region={{
                latitude: activity.location.latitude,
                longitude: activity.location.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
            >
              <Marker coordinate={activity.location} pinColor={theme.brand.primary} />
            </MapView>
          </View>
          <Pressable style={styles.directionsRow} onPress={handleGetDirections}>
            <Text style={styles.locationLabel}>{activity.location.label}</Text>
            <View style={styles.directionsButton}>
              <NavigationArrow size={14} color={theme.text.accent} weight="fill" />
              <Text style={styles.directionsLabel}>Directions</Text>
            </View>
          </Pressable>

          <Text style={styles.sectionLabel}>Who's going</Text>
          <View style={styles.attendeeRow}>
            {activity.attendees.slice(0, 5).map((attendee, index) => (
              <View
                key={attendee.id}
                style={[
                  styles.attendeeAvatar,
                  { backgroundColor: attendee.avatarColor, marginLeft: index === 0 ? 0 : -10 },
                ]}
              />
            ))}
            <Text style={styles.attendeeCount}>
              {activity.attendeeCount} going
              {spotsLeft !== null && spotsLeft > 0 && ` · ${spotsLeft} spots left`}
            </Text>
          </View>
        </View>
      </ScrollView>

      <View style={styles.ctaBar}>
        <Pressable
          style={[
            styles.ctaButton,
            activity.viewerStatus !== 'none' && styles.ctaButtonGoing,
          ]}
          onPress={handleJoinPress}
          disabled={isSubmitting}
        >
          <Text
            style={[
              styles.ctaLabel,
              activity.viewerStatus !== 'none' && styles.ctaLabelGoing,
            ]}
          >
            {activity.viewerStatus === 'going' && "You're going"}
            {activity.viewerStatus === 'waitlisted' && 'On the waitlist'}
            {activity.viewerStatus === 'none' && (isFull ? 'Join waitlist' : 'Join this activity')}
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background.surface },
  hero: { height: 220, backgroundColor: theme.brand.primaryTint },
  heroOverlay: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
  },
  roundButton: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(254,253,251,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: spacing.xl },
  categoryPill: {
    alignSelf: 'flex-start',
    backgroundColor: theme.brand.primaryTint,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    marginBottom: spacing.sm,
  },
  categoryPillText: { ...typography.caption, color: theme.text.accent },
  title: { ...typography.title2, color: theme.text.primary, marginBottom: 4 },
  meta: { ...typography.subhead, color: theme.text.secondary, marginBottom: spacing.lg },
  hostRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border.default,
    marginBottom: spacing.lg,
  },
  hostAvatar: { width: 40, height: 40, borderRadius: radius.pill, marginRight: spacing.md },
  hostInfo: { flex: 1 },
  hostNameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  hostName: { ...typography.bodyMedium, color: theme.text.primary },
  hostBio: { ...typography.footnote, color: theme.text.secondary, marginTop: 2 },
  messageLink: { ...typography.footnote, fontWeight: '600' as const, color: theme.text.accent },
  sectionLabel: { ...typography.bodyMedium, color: theme.text.primary, marginBottom: spacing.sm },
  description: { ...typography.subhead, color: theme.text.secondary, lineHeight: 21, marginBottom: spacing.lg },
  mapPlaceholder: {
    height: 120,
    borderRadius: radius.lg,
    backgroundColor: theme.brand.accentTint,
    marginBottom: spacing.sm,
    overflow: 'hidden',
  },
  locationLabel: { ...typography.footnote, color: theme.text.secondary, flexShrink: 1 },
  directionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  directionsButton: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  directionsLabel: { ...typography.caption, color: theme.text.accent, fontWeight: '600' as const },
  attendeeRow: { flexDirection: 'row', alignItems: 'center' },
  attendeeAvatar: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: theme.background.surface,
  },
  attendeeCount: { ...typography.footnote, color: theme.text.secondary, marginLeft: spacing.md },
  ctaBar: {
    padding: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border.default,
    backgroundColor: theme.background.surface,
  },
  ctaButton: {
    backgroundColor: theme.brand.primary,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  ctaButtonGoing: {
    backgroundColor: theme.brand.primaryTint,
  },
  ctaLabel: { ...typography.headline, color: theme.text.inverse },
  ctaLabelGoing: { color: theme.text.accent },
});
