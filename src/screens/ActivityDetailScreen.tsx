import React, { useEffect, useState } from 'react';
import { View, Text, Image, ScrollView, Pressable, StyleSheet, Linking, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Notifications from 'expo-notifications';
import { ArrowLeft, DotsThree, SealCheck, NavigationArrow, ChatCircleDots, PencilSimple } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import type { ActivityDetail } from '@/types/activity';
import { CATEGORY_LABELS } from '@/types/activity';
import { formatStartTime } from '@/utils/formatStartTime';
import { formatDuration } from '@/utils/formatDuration';
import { formatAgeRange } from '@/utils/babyAge';
import { useActivityRsvp } from '@/hooks/useActivityRsvp';
import { useAuth } from '@/hooks/useAuth';
import { AddToCalendarSheet } from '@/components/AddToCalendarSheet';
import { CoverImage } from '@/components/CoverImage';
import { NotificationPermissionSheet } from '@/components/NotificationPermissionSheet';
import { hasCalendarDrift, updateCalendarEvent, removeCalendarEvent } from '@/lib/activityCalendar';
import {
  scheduleActivityReminders,
  cancelActivityReminders,
  rescheduleActivityReminders,
} from '@/lib/activityReminders';

interface ActivityDetailScreenProps {
  activity: ActivityDetail;
  onBack: () => void;
  onReport: () => void;
  onMessageHost: (hostId: string) => void;
  /** Called once the person successfully joins — screen can navigate to the group chat */
  onJoined: (activity: ActivityDetail) => void;
  /** Host or anyone already going can reopen the group chat at any time */
  onOpenChat?: () => void;
  canOpenChat?: boolean;
  hasUnreadChat?: boolean;
  isHost?: boolean;
  onEdit?: () => void;
}

export function ActivityDetailScreen({
  activity: initial,
  onBack,
  onReport,
  onMessageHost,
  onJoined,
  onOpenChat,
  canOpenChat = false,
  hasUnreadChat = false,
  isHost = false,
  onEdit,
}: ActivityDetailScreenProps) {
  const { activity, isSubmitting, error, join, leave } = useActivityRsvp(initial);
  const { profile } = useAuth();
  const remindersEnabled = profile?.notificationPreferences.reminders ?? true;
  const [showCalendarSheet, setShowCalendarSheet] = useState(false);
  const [showNotificationSheet, setShowNotificationSheet] = useState(false);
  const [calendarNotice, setCalendarNotice] = useState<'changed' | 'cancelled' | null>(null);

  const isCancelled = activity.status === 'cancelled';
  const isEnded = activity.status === 'completed';
  const isFull = activity.status === 'full';
  const canJoin = !isCancelled && !isEnded && (activity.viewerStatus === 'going' || !isFull);
  const spotsLeft =
    activity.capacity !== null ? Math.max(0, activity.capacity - activity.attendeeCount) : null;

  const calendarInfo = {
    id: activity.id,
    title: activity.title,
    description: activity.description,
    startsAt: new Date(activity.startTime),
    durationMinutes: activity.durationMinutes,
    locationName: activity.location.label,
  };

  useEffect(() => {
    if (activity.viewerStatus !== 'going') return;

    if (isCancelled) {
      cancelActivityReminders(activity.id);
    } else {
      rescheduleActivityReminders(
        { id: activity.id, title: activity.title, startsAt: new Date(activity.startTime) },
        remindersEnabled,
      );
    }

    hasCalendarDrift(calendarInfo).then((drift) => {
      if (isCancelled && drift !== 'not_linked') setCalendarNotice('cancelled');
      else if (drift === 'changed') setCalendarNotice('changed');
    });
    // Only re-check when the fields that matter for drift actually change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activity.viewerStatus, activity.startTime, activity.location.label, isCancelled]);

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
      const joined = await join();
      if (joined) {
        const { status } = await Notifications.getPermissionsAsync();
        if (status === 'undetermined') {
          setShowNotificationSheet(true);
        } else {
          scheduleActivityReminders(
            { id: activity.id, title: activity.title, startsAt: new Date(activity.startTime) },
            remindersEnabled,
          );
          setShowCalendarSheet(true);
        }
      }
    } else {
      await leave();
      await cancelActivityReminders(activity.id);
    }
  };

  const proceedToCalendarStep = () => {
    setShowNotificationSheet(false);
    setShowCalendarSheet(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <CoverImage
            url={activity.coverImageUrl}
            fallbackCategory={activity.category}
            style={StyleSheet.absoluteFill}
          />
          <SafeAreaView edges={['top']} style={styles.heroOverlay}>
            <Pressable style={styles.roundButton} onPress={onBack} accessibilityLabel="Back">
              <ArrowLeft size={18} color={theme.text.primary} />
            </Pressable>
            <View style={styles.heroActions}>
              {isHost && onEdit && (
                <Pressable style={styles.roundButton} onPress={onEdit} accessibilityLabel="Edit activity">
                  <PencilSimple size={18} color={theme.text.primary} />
                </Pressable>
              )}
              <Pressable style={styles.roundButton} onPress={onReport} accessibilityLabel="More options">
                <DotsThree size={18} color={theme.text.primary} weight="bold" />
              </Pressable>
            </View>
          </SafeAreaView>
        </View>

        <View style={styles.content}>
          <View style={styles.pillRow}>
            <View style={styles.categoryPill}>
              <Text style={styles.categoryPillText}>
                {CATEGORY_LABELS[activity.category]}
              </Text>
            </View>
            {isCancelled && (
              <View style={[styles.categoryPill, styles.statusPillCancelled]}>
                <Text style={[styles.categoryPillText, styles.statusPillTextCancelled]}>Cancelled</Text>
              </View>
            )}
            {isEnded && !isCancelled && (
              <View style={[styles.categoryPill, styles.statusPillEnded]}>
                <Text style={[styles.categoryPillText, styles.statusPillTextEnded]}>Ended</Text>
              </View>
            )}
            {isFull && !isCancelled && !isEnded && (
              <View style={[styles.categoryPill, styles.statusPillFull]}>
                <Text style={[styles.categoryPillText, styles.statusPillTextFull]}>Full</Text>
              </View>
            )}
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

          {canOpenChat && onOpenChat && (
            <Pressable style={styles.chatRow} onPress={onOpenChat}>
              <ChatCircleDots size={18} color={theme.brand.primary} weight="fill" />
              <Text style={styles.chatRowLabel}>Open group chat</Text>
              {hasUnreadChat && <View style={styles.unreadDot} />}
            </Pressable>
          )}

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

          {calendarNotice && (
            <View style={styles.calendarNotice}>
              <Text style={styles.calendarNoticeText}>
                {calendarNotice === 'cancelled'
                  ? "This activity was cancelled — remove it from your calendar?"
                  : "This activity's time or location changed — update your calendar event?"}
              </Text>
              <Pressable
                style={styles.calendarNoticeButton}
                onPress={async () => {
                  if (calendarNotice === 'cancelled') await removeCalendarEvent(activity.id);
                  else await updateCalendarEvent(calendarInfo);
                  setCalendarNotice(null);
                }}
              >
                <Text style={styles.calendarNoticeButtonLabel}>
                  {calendarNotice === 'cancelled' ? 'Remove' : 'Update'}
                </Text>
              </Pressable>
            </View>
          )}

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
        {error && <Text style={styles.ctaError}>{error}</Text>}
        <Pressable
          style={[
            styles.ctaButton,
            activity.viewerStatus === 'going' && styles.ctaButtonGoing,
            !canJoin && activity.viewerStatus === 'none' && styles.ctaButtonDisabled,
          ]}
          onPress={handleJoinPress}
          disabled={isSubmitting || (!canJoin && activity.viewerStatus === 'none')}
        >
          <Text
            style={[
              styles.ctaLabel,
              activity.viewerStatus === 'going' && styles.ctaLabelGoing,
            ]}
          >
            {isCancelled && 'This activity was cancelled'}
            {!isCancelled && isEnded && 'This activity has ended'}
            {!isCancelled && !isEnded && activity.viewerStatus === 'going' && "You're going"}
            {!isCancelled && !isEnded && activity.viewerStatus === 'none' && (isFull ? 'Activity full' : 'Join this activity')}
          </Text>
        </Pressable>
      </View>

      <NotificationPermissionSheet
        visible={showNotificationSheet}
        onEnable={() => {
          scheduleActivityReminders(
            { id: activity.id, title: activity.title, startsAt: new Date(activity.startTime) },
            remindersEnabled,
          );
          proceedToCalendarStep();
        }}
        onDismiss={proceedToCalendarStep}
      />

      <AddToCalendarSheet
        visible={showCalendarSheet}
        activity={calendarInfo}
        onDismiss={() => {
          setShowCalendarSheet(false);
          onJoined(activity);
        }}
      />
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
  heroActions: { flexDirection: 'row', gap: spacing.sm },
  roundButton: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(254,253,251,0.9)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: { padding: spacing.xl },
  pillRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  categoryPill: {
    alignSelf: 'flex-start',
    backgroundColor: theme.brand.primaryTint,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  categoryPillText: { ...typography.caption, color: theme.text.accent },
  statusPillCancelled: { backgroundColor: '#F5DFDA' },
  statusPillTextCancelled: { color: theme.semantic.danger },
  statusPillEnded: { backgroundColor: theme.background.app },
  statusPillTextEnded: { color: theme.text.muted },
  statusPillFull: { backgroundColor: theme.brand.secondaryTint },
  statusPillTextFull: { color: theme.brand.secondary },
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
  chatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: theme.brand.primaryTint,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginBottom: spacing.lg,
  },
  chatRowLabel: { ...typography.bodyMedium, color: theme.brand.primaryPressed },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.semantic.danger,
    marginLeft: 'auto',
  },
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
  calendarNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.brand.secondaryTint,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  calendarNoticeText: { ...typography.footnote, color: theme.text.primary, flex: 1 },
  calendarNoticeButton: {
    backgroundColor: theme.brand.secondary,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  calendarNoticeButtonLabel: { ...typography.caption, color: theme.text.inverse, fontWeight: '600' as const },
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
  ctaButtonDisabled: { opacity: 0.5 },
  ctaLabel: { ...typography.headline, color: theme.text.inverse },
  ctaLabelGoing: { color: theme.text.accent },
  ctaError: {
    ...typography.footnote,
    color: theme.semantic.danger,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});
