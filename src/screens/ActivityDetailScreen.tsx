import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Linking, Platform, Alert, Share, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Notifications from 'expo-notifications';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, DotsThree, NavigationArrow, ChatCircleDots, PencilSimple, ShareNetwork } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { PersonCard } from '@/components/PersonCard';
import type { ActivityDetail } from '@/types/activity';
import { CATEGORY_LABELS } from '@/types/activity';
import { formatExactStartTime } from '@/utils/formatExactStartTime';
import { formatDuration } from '@/utils/formatDuration';
import { resolveParticipantCounts } from '@/utils/attendanceSummary';
import { resolveBadges, resolveLifecycle } from '@/utils/activityLifecycle';
import { formatAgeRange } from '@/utils/babyAge';
import { buildShareMessage } from '@/utils/buildShareMessage';
import { APP_NAME } from '@/constants/brand';
import { useActivityRsvp } from '@/hooks/useActivityRsvp';
import { useActivityAttendance } from '@/hooks/useActivityAttendance';
import { useAuth } from '@/hooks/useAuth';
import { useChildren } from '@/hooks/useChildren';
import { useReportAndBlock } from '@/hooks/useReportAndBlock';
import { AddToCalendarSheet } from '@/components/AddToCalendarSheet';
import { JoinActivitySheet } from '@/components/JoinActivitySheet';
import { CoverImage } from '@/components/CoverImage';
import { CoverFrame } from '@/components/CoverFrame';
import { NotificationPermissionSheet } from '@/components/NotificationPermissionSheet';
import { PhotoNudgeSheet } from '@/components/PhotoNudgeSheet';
import { usePhotoNudge } from '@/hooks/usePhotoNudge';
import { hasCalendarDrift, updateCalendarEvent, removeCalendarEvent } from '@/lib/activityCalendar';
import {
  scheduleActivityReminders,
  cancelActivityReminders,
  rescheduleActivityReminders,
} from '@/lib/activityReminders';

interface ActivityDetailScreenProps {
  activity: ActivityDetail;
  onBack: () => void;
  onMessageHost: (hostId: string) => void;
  onOpenPerson: (userId: string) => void;
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
  onMessageHost,
  onOpenPerson,
  onJoined,
  onOpenChat,
  canOpenChat = false,
  hasUnreadChat = false,
  isHost = false,
  onEdit,
}: ActivityDetailScreenProps) {
  const attendance = useActivityAttendance(initial.id);
  const { activity, isSubmitting, error, join, leave } = useActivityRsvp(initial, attendance.refresh);
  const { profile, session, updateProfileDetails } = useAuth();
  const { children, setDefaultChild } = useChildren(session?.user.id ?? null);
  const { submitReport, blockUser } = useReportAndBlock();
  const { shouldShow: shouldShowPhotoNudge, markShown: markPhotoNudgeShown } = usePhotoNudge();
  const remindersEnabled = profile?.notificationPreferences.reminders ?? true;
  const [showCalendarSheet, setShowCalendarSheet] = useState(false);
  const [showNotificationSheet, setShowNotificationSheet] = useState(false);
  const [showPhotoNudge, setShowPhotoNudge] = useState(false);
  const [calendarNotice, setCalendarNotice] = useState<'changed' | 'cancelled' | null>(null);

  const relationship = isHost ? 'hosting' : activity.viewerStatus === 'going' ? 'joined' : 'none';
  const lifecycle = resolveLifecycle(activity);
  const badges = resolveBadges(activity, relationship);
  const isCancelled = lifecycle === 'cancelled';
  const isEnded = lifecycle === 'completed';
  const isFull = lifecycle === 'full';
  const canJoin = !isCancelled && !isEnded && (activity.viewerStatus === 'going' || !isFull);
  const spotsLeft =
    activity.capacity !== null ? Math.max(0, activity.capacity - activity.attendeeCount) : null;
  const participantCounts = resolveParticipantCounts(attendance.people, activity.capacity);
  const displayedParticipantCount = attendance.isLoading || attendance.error
    ? activity.attendeeCount
    : participantCounts.count;
  const displayedSpotsLeft = attendance.isLoading || attendance.error
    ? spotsLeft
    : participantCounts.spotsLeft;
  const hostAttendance = attendance.people.find((person) => person.isHost || person.userId === activity.host.id);
  const joiningParticipants = attendance.people.filter(
    (person) => !person.isHost && person.userId !== activity.host.id,
  );

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

  const promptReportReason = () => {
    Alert.prompt(
      'Report this activity',
      `Tell us what's wrong — this goes to the ${APP_NAME} team, not the host.`,
      async (reason) => {
        if (!reason?.trim()) return;
        const err = await submitReport({
          reportedUserId: activity.host.id,
          activityId: activity.id,
          reason: reason.trim(),
        });
        Alert.alert(err ? "Couldn't send your report" : 'Report sent', err ?? "Thanks — we'll take a look.");
      },
      'plain-text',
    );
  };

  const confirmBlockHost = () => {
    Alert.alert(
      `Block ${activity.host.displayName}?`,
      "You won't see their activities or messages anymore. This can be undone from Profile settings.",
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Block',
          style: 'destructive',
          onPress: async () => {
            const err = await blockUser(activity.host.id);
            if (err) Alert.alert("Couldn't block", err);
          },
        },
      ],
    );
  };

  const handleShare = async () => {
    const message = buildShareMessage({
      id: activity.id,
      title: activity.title,
      category: activity.category,
      startsAt: new Date(activity.startTime),
      locationName: activity.location.label,
      durationMinutes: activity.durationMinutes,
      babyMinAgeMonths: activity.babyMinAgeMonths,
      babyMaxAgeMonths: activity.babyMaxAgeMonths,
      status: activity.status,
    });
    try {
      await Share.share({ message });
    } catch {
      // User dismissed the native share sheet — nothing to recover from.
    }
  };

  const handleMorePress = () => {
    Alert.alert('Activity options', undefined, [
      { text: 'Report this activity', onPress: promptReportReason },
      { text: `Block ${activity.host.displayName}`, style: 'destructive', onPress: confirmBlockHost },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const isAgeRelevant = activity.babyMinAgeMonths !== null || activity.babyMaxAgeMonths !== null;
  const [showJoinSheet, setShowJoinSheet] = useState(false);

  const performJoin = async (childIds: string[]) => {
    // Whichever child the parent is coming with becomes the default used for
    // age-matching elsewhere in the app — mirrors the age-eligibility
    // guidance the join sheet already shows for this activity.
    const firstChild = children.find((c) => childIds.includes(c.id));
    if (firstChild && !firstChild.isDefault) await setDefaultChild(firstChild.id);
    const joined = await join(childIds);
    setShowJoinSheet(false);
    if (joined) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
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
  };

  const handleJoinPress = async () => {
    if (activity.viewerStatus === 'none') {
      if (children.length > 0) {
        setShowJoinSheet(true);
        return;
      }
      await performJoin([]);
    } else {
      Alert.alert('Leave this activity?', "You'll lose your spot, and it may fill up.", [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            await leave();
            await cancelActivityReminders(activity.id);
          },
        },
      ]);
    }
  };

  const proceedToCalendarStep = () => {
    setShowNotificationSheet(false);
    setShowCalendarSheet(true);
  };

  const handleCalendarSheetDismiss = async () => {
    setShowCalendarSheet(false);
    if (await shouldShowPhotoNudge(Boolean(profile?.avatarUrl))) {
      setShowPhotoNudge(true);
    } else {
      onJoined(activity);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.topBar}>
        <Pressable style={styles.roundButton} onPress={onBack} accessibilityLabel="Back">
          <ArrowLeft size={20} color={theme.text.primary} />
        </Pressable>
        <View style={styles.heroActions}>
          {!isCancelled && (
            <Pressable style={styles.roundButton} onPress={handleShare} accessibilityLabel="Share activity">
              <ShareNetwork size={18} color={theme.text.primary} />
            </Pressable>
          )}
          {isHost && onEdit && (
            <Pressable style={styles.roundButton} onPress={onEdit} accessibilityLabel="Edit activity">
              <PencilSimple size={18} color={theme.text.primary} />
            </Pressable>
          )}
          <Pressable style={styles.roundButton} onPress={handleMorePress} accessibilityLabel="More options">
            <DotsThree size={18} color={theme.text.primary} weight="bold" />
          </Pressable>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Contained, aspect-matched cover card — not a full-bleed
            background. The activity art is 4:3; matching the card's own
            aspect ratio to that means resizeMode="cover" never has to
            crop away meaningful content the way an oversized wide hero
            forced it to. */}
        <CoverFrame variant="hero" radius={radius.xl} style={styles.coverCard}>
          <CoverImage
            url={activity.coverImageUrl}
            fallbackCategory={activity.category}
            variant="hero"
            surface="ActivityDetail"
            style={StyleSheet.absoluteFill}
          />
        </CoverFrame>

        <View style={styles.content}>
          <View style={styles.pillRow}>
            <View style={styles.categoryPill}>
              <Text style={styles.categoryPillText}>
                {CATEGORY_LABELS[activity.category] ?? CATEGORY_LABELS.other}
              </Text>
            </View>
            {badges.lifecycle && (
              <View style={[styles.categoryPill, isCancelled ? styles.statusPillCancelled : styles.statusPillLifecycle]}>
                <Text style={[styles.categoryPillText, isCancelled ? styles.statusPillTextCancelled : styles.statusPillTextLifecycle]}>
                  {badges.lifecycle}
                </Text>
              </View>
            )}
            {badges.relationship && (
              <View style={[styles.categoryPill, styles.relationshipPill]}>
                <Text style={[styles.categoryPillText, styles.relationshipPillText]}>{badges.relationship}</Text>
              </View>
            )}
          </View>
          <Text style={styles.title}>{activity.title}</Text>
          <Text style={styles.meta}>
            {formatExactStartTime(activity.startTime)} · {formatDuration(activity.durationMinutes)} ·{' '}
            {activity.distanceKm.toFixed(1)}km away
          </Text>
          <Text style={styles.meta}>
            Baby age: {formatAgeRange(activity.babyMinAgeMonths, activity.babyMaxAgeMonths)}
          </Text>

          {/* Kept in the existing people card position and visual language;
              the richer rows replace the old overlapping avatar stack. */}
          <View style={styles.peopleCard}>
            <View style={styles.participantsHeader}>
              <Text style={styles.peopleCardLabel}>
                Participants · {displayedParticipantCount}
                {activity.capacity !== null ? `/${activity.capacity}` : ''}
              </Text>
              {displayedSpotsLeft !== null && displayedSpotsLeft > 0 ? (
                <Text style={styles.spotsLabel}>
                  {displayedSpotsLeft === 1 ? '1 spot left' : `${displayedSpotsLeft} spots left`}
                </Text>
              ) : null}
            </View>

            <Text style={styles.participantGroupLabel}>Host</Text>
            <PersonCard
              size="row"
              name={firstName(hostAttendance?.displayName ?? activity.host.displayName)}
              avatarUrl={hostAttendance?.avatarUrl ?? activity.host.avatarUrl}
              subtitle={hostAttendance?.withLabel ?? (attendance.isLoading ? 'Loading attendance…' : 'Coming alone')}
              onPress={() => onOpenPerson(activity.host.id)}
              accessoryRight={
                <Pressable onPress={() => onMessageHost(activity.host.id)} hitSlop={12}>
                  <Text style={styles.messageLink}>Message</Text>
                </Pressable>
              }
            />

            <Text style={styles.participantGroupLabel}>Joining</Text>
            {attendance.isLoading ? (
              <View style={styles.participantsState}>
                <ActivityIndicator size="small" color={theme.brand.primary} />
                <Text style={styles.participantsStateText}>Loading participants…</Text>
              </View>
            ) : attendance.error ? (
              <Pressable style={styles.participantsState} onPress={attendance.refresh}>
                <Text style={styles.participantsError}>{attendance.error}</Text>
                <Text style={styles.retryLabel}>Try again</Text>
              </Pressable>
            ) : joiningParticipants.length === 0 ? (
              <Text style={styles.participantsStateText}>No one else has joined yet.</Text>
            ) : (
              joiningParticipants.map((person) => (
                <PersonCard
                  key={person.userId}
                  size="row"
                  name={firstName(person.displayName)}
                  avatarUrl={person.avatarUrl}
                  subtitle={person.withLabel}
                  onPress={() => onOpenPerson(person.userId)}
                />
              ))
            )}
            <Text style={styles.tapHint}>Tap a participant to see their profile →</Text>
          </View>

          {canOpenChat && onOpenChat && (
            <Pressable style={styles.chatRow} onPress={onOpenChat}>
              <ChatCircleDots size={18} color={theme.brand.primary} weight="fill" />
              <Text style={styles.chatRowLabel}>Open group chat</Text>
              {hasUnreadChat && <View style={styles.unreadDot} />}
            </Pressable>
          )}

          {activity.description ? (
            <>
              <Text style={styles.sectionLabel}>Details</Text>
              <Text style={styles.description}>{activity.description}</Text>
            </>
          ) : null}

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
        </View>
      </ScrollView>

      <View style={styles.ctaBar}>
        {error && <Text style={styles.ctaError}>{error}</Text>}
        {isHost ? (
          // The creator is always a participant (host auto-join happens at
          // creation time) — never show a normal Join/Leave affordance for
          // their own activity, even if a legacy row is somehow missing its
          // host attendee row (activity.hostId is the authoritative check
          // here, not viewerStatus, which depends on that row existing).
          <View style={[styles.ctaButton, styles.ctaButtonGoing]}>
            <Text style={[styles.ctaLabel, styles.ctaLabelGoing]}>You're hosting</Text>
          </View>
        ) : (
          <Pressable
            style={({ pressed }) => [
              styles.ctaButton,
              activity.viewerStatus === 'going' && styles.ctaButtonGoing,
              !canJoin && activity.viewerStatus === 'none' && styles.ctaButtonDisabled,
              pressed && styles.ctaButtonPressed,
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
              {!isCancelled && isEnded && 'This activity is completed'}
              {!isCancelled && !isEnded && activity.viewerStatus === 'going' && "You're going"}
              {!isCancelled && !isEnded && activity.viewerStatus === 'none' && (isFull ? 'Activity full' : 'Join this activity')}
            </Text>
          </Pressable>
        )}
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

      <AddToCalendarSheet visible={showCalendarSheet} activity={calendarInfo} onDismiss={handleCalendarSheetDismiss} />

      <JoinActivitySheet
        visible={showJoinSheet}
        activityTitle={activity.title}
        ageHint={
          isAgeRelevant
            ? `${activity.title} is for babies ${formatAgeRange(activity.babyMinAgeMonths, activity.babyMaxAgeMonths)}.`
            : null
        }
        children={children}
        isSubmitting={isSubmitting}
        onConfirm={performJoin}
        onDismiss={() => setShowJoinSheet(false)}
      />

      <PhotoNudgeSheet
        visible={showPhotoNudge}
        onAddPhoto={async (uri) => {
          setShowPhotoNudge(false);
          await markPhotoNudgeShown();
          if (profile) await updateProfileDetails({ displayName: profile.displayName, phone: profile.phone, photoUri: uri });
          onJoined(activity);
        }}
        onDismiss={async () => {
          setShowPhotoNudge(false);
          await markPhotoNudgeShown();
          onJoined(activity);
        }}
      />
    </SafeAreaView>
  );
}

function firstName(displayName: string): string {
  return displayName.trim().split(/\s+/)[0] || 'Parent';
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background.app },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  // Width/margins only — CoverFrame owns the aspect ratio, the hero height
  // cap and the clipping, so this can never drift back into a full-bleed
  // background or an oversized fixed height.
  coverCard: {
    width: 'auto',
    marginHorizontal: spacing.xl,
    backgroundColor: theme.brand.primaryTint,
  },
  heroActions: { flexDirection: 'row', gap: spacing.sm },
  roundButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: theme.background.surface,
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
  statusPillCancelled: { backgroundColor: theme.semantic.dangerTint },
  statusPillTextCancelled: { color: theme.semantic.danger },
  statusPillLifecycle: { backgroundColor: theme.brand.secondaryTint },
  statusPillTextLifecycle: { color: theme.brand.secondary },
  relationshipPill: { backgroundColor: theme.brand.primaryTint },
  relationshipPillText: { color: theme.brand.primaryPressed },
  title: { ...typography.title2, color: theme.text.primary, marginBottom: 4 },
  meta: { ...typography.subhead, color: theme.text.secondary, marginBottom: spacing.lg },
  peopleCard: {
    backgroundColor: theme.brand.primaryTint,
    borderRadius: radius.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    gap: spacing.md,
  },
  peopleCardLabel: { ...typography.caption, fontWeight: '700' as const, color: theme.brand.primaryPressed, letterSpacing: 0.4 },
  participantsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  spotsLabel: { ...typography.caption, color: theme.brand.primaryPressed },
  participantGroupLabel: { ...typography.caption, fontWeight: '600' as const, color: theme.text.secondary, marginTop: spacing.xs },
  participantsState: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
  participantsStateText: { ...typography.footnote, color: theme.text.secondary },
  participantsError: { ...typography.footnote, color: theme.semantic.danger, flex: 1 },
  retryLabel: { ...typography.footnote, color: theme.text.accent, fontWeight: '600' as const },
  messageLink: { ...typography.footnote, fontWeight: '600' as const, color: theme.text.accent },
  tapHint: { ...typography.caption, color: theme.brand.primaryPressed },
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
  ctaButtonPressed: { opacity: 0.85 },
  ctaLabel: { ...typography.headline, color: theme.text.inverse },
  ctaLabelGoing: { color: theme.text.accent },
  ctaError: {
    ...typography.footnote,
    color: theme.semantic.danger,
    textAlign: 'center',
    marginBottom: spacing.sm,
  },
});
