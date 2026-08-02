import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, SectionList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ChatCircleDots, CaretDown, CaretUp, UsersThree, Plus } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { StateCard } from '@/components/StateCard';
import { PersonCard } from '@/components/PersonCard';
import { CoverImage } from '@/components/CoverImage';
import { CoverFrame } from '@/components/CoverFrame';
import { useConversations, type Conversation } from '@/hooks/useConversations';
import { formatRelativeTime } from '@/utils/formatRelativeTime';
import { formatExactStartTime } from '@/utils/formatExactStartTime';
import { CATEGORY_LABELS } from '@/types/activity';
import { groupConversations } from '@/utils/groupConversations';
import { resolveChatsUpcomingState } from '@/utils/resolveChatsUpcomingState';

interface MessagesScreenProps {
  onOpenConversation: (conversation: Conversation) => void;
  onCreateActivity: () => void;
}

type Section = { key: 'upcoming' | 'direct' | 'past'; title: string; data: Conversation[] };

/** The Chats tab — activity group chats grouped into "my upcoming plans"
 *  and a quieter, collapsed-by-default past archive, plus a standing
 *  section for person-to-person direct chats (not activity-dated, so they
 *  don't fit either bucket). This reads as "my upcoming communities and
 *  plans," not a generic flat inbox. */
export function MessagesScreen({ onOpenConversation, onCreateActivity }: MessagesScreenProps) {
  const { conversations, isLoading, error, refresh } = useConversations();
  const [pastOpen, setPastOpen] = useState(false);

  // Chats stays mounted for the whole session (a sibling tab under the
  // same root, not a fresh screen instance each visit) — without this,
  // useConversations only ever fetched once, on the very first time this
  // tab was shown, so a chat created for a brand-new activity while the
  // parent was elsewhere in the app never appeared until something else
  // forced a remount.
  useFocusEffect(
    useCallback(() => {
      refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const { upcoming, past, direct } = useMemo(() => groupConversations(conversations), [conversations]);
  const upcomingState = resolveChatsUpcomingState(upcoming.length, past.length);

  const sections = useMemo<Section[]>(() => {
    const result: Section[] = [];
    if (upcoming.length > 0) result.push({ key: 'upcoming', title: 'Upcoming activities', data: upcoming });
    if (direct.length > 0) result.push({ key: 'direct', title: 'Direct messages', data: direct });
    if (past.length > 0) result.push({ key: 'past', title: 'Past activities', data: pastOpen ? past : [] });
    return result;
  }, [upcoming, direct, past, pastOpen]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Text style={styles.headerTitle}>Chats</Text>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.chatId}
        contentContainerStyle={conversations.length === 0 ? styles.emptyContent : styles.listContent}
        stickySectionHeadersEnabled={false}
        // The "no upcoming activities" nudge always sits where the
        // Upcoming section would be — even when Past/Direct chats exist
        // below, since those don't answer "what do I do next."
        ListHeaderComponent={
          upcomingState !== 'has-upcoming' ? (
            <UpcomingEmptyState onCreateActivity={onCreateActivity} />
          ) : null
        }
        renderSectionHeader={({ section }) =>
          section.key === 'past' ? (
            <Pressable style={styles.pastHeader} onPress={() => setPastOpen((v) => !v)}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              {pastOpen ? (
                <CaretUp size={16} color={theme.text.secondary} />
              ) : (
                <CaretDown size={16} color={theme.text.secondary} />
              )}
            </Pressable>
          ) : (
            <Text style={styles.sectionTitle}>{section.title}</Text>
          )
        }
        renderItem={({ item }) =>
          item.activity ? (
            <ActivityConversationRow conversation={item} onPress={() => onOpenConversation(item)} />
          ) : (
            <DirectConversationRow conversation={item} onPress={() => onOpenConversation(item)} />
          )
        }
        ListEmptyComponent={
          !isLoading && error ? (
            <StateCard
              icon={ChatCircleDots}
              title="Couldn't load your messages."
              body="Tap below to try again."
              ctaLabel="Try again"
              onCtaPress={refresh}
              tone="warning"
            />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function UpcomingEmptyState({ onCreateActivity }: { onCreateActivity: () => void }) {
  return (
    <View style={styles.upcomingEmptyWrap}>
      <Text style={styles.sectionTitle}>Upcoming activities</Text>
      <View style={styles.upcomingEmptyCard}>
        <View style={styles.upcomingEmptyText}>
          <Text style={styles.upcomingEmptyTitle}>No upcoming activities yet</Text>
          <Text style={styles.upcomingEmptyBody}>Be the first to create one.</Text>
        </View>
        <Pressable
          style={styles.upcomingEmptyCta}
          onPress={onCreateActivity}
          accessibilityRole="button"
          accessibilityLabel="Create an activity"
        >
          <Plus size={22} color={theme.text.inverse} weight="bold" />
        </Pressable>
      </View>
    </View>
  );
}

function ActivityConversationRow({
  conversation,
  onPress,
}: {
  conversation: Conversation;
  onPress: () => void;
}) {
  const activity = conversation.activity!;
  const timingLabel = formatExactStartTime(activity.startTime);
  const previewText = conversation.lastMessagePreview
    ? conversation.lastMessageSenderName
      ? `${conversation.lastMessageSenderName}: ${conversation.lastMessagePreview}`
      : conversation.lastMessagePreview
    : 'Say hello 👋';

  return (
    <Pressable
      style={[styles.activityRow, conversation.hasUnread && styles.activityRowUnread]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <CoverFrame variant="thumb" radius={radius.md} style={styles.activityThumb}>
        <CoverImage
          url={activity.coverImageUrl}
          fallbackCategory={activity.category}
          variant="thumb"
          surface="ChatsThumbnail"
          style={styles.activityThumbFill}
        />
      </CoverFrame>
      <View style={styles.activityBody}>
        <View style={styles.activityTitleLine}>
          <Text style={[styles.activityTitle, conversation.hasUnread && styles.unreadText]} numberOfLines={1}>
            {conversation.title}
          </Text>
          {conversation.hasUnread && <View style={styles.unreadDot} />}
        </View>
        {/* The activity's own scheduled time is the main time context for
            an activity chat — not when the last message happened to be
            sent, which competes with it and reads as "when this is". */}
        <Text style={styles.activityMeta} numberOfLines={1}>
          {CATEGORY_LABELS[activity.category] ?? CATEGORY_LABELS.other} · {timingLabel} · {activity.locationLabel}
        </Text>
        <View style={styles.activityFooterLine}>
          <Text
            style={[styles.activityPreview, conversation.hasUnread && styles.unreadText]}
            numberOfLines={1}
          >
            {previewText}
          </Text>
          <View style={styles.activityFooterRight}>
            <UsersThree size={12} color={theme.text.muted} weight="bold" />
            <Text style={styles.activityCount}>{activity.attendeeCount}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

function DirectConversationRow({ conversation, onPress }: { conversation: Conversation; onPress: () => void }) {
  return (
    <View style={styles.rowWrap}>
      <PersonCard
        size="row"
        name={conversation.title}
        avatarUrl={conversation.avatarUrl}
        subtitle={conversation.subtitle}
        onPress={onPress}
        accessoryRight={
          <View style={styles.accessory}>
            {conversation.lastMessageAt && (
              <Text style={styles.timestamp}>{formatRelativeTime(conversation.lastMessageAt)}</Text>
            )}
            {conversation.hasUnread && <View style={styles.unreadDot} />}
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background.app },
  headerTitle: { ...typography.title1, color: theme.text.primary, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing['4xl'], gap: spacing.sm },
  emptyContent: { flexGrow: 1 },
  upcomingEmptyWrap: { gap: spacing.sm, marginBottom: spacing.md },
  upcomingEmptyCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.background.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border.default,
    padding: spacing.lg,
    gap: spacing.md,
  },
  upcomingEmptyText: { flex: 1, gap: 2 },
  upcomingEmptyTitle: { ...typography.bodyMedium, color: theme.text.primary },
  upcomingEmptyBody: { ...typography.footnote, color: theme.text.secondary },
  upcomingEmptyCta: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: theme.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    ...typography.footnote,
    color: theme.text.secondary,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  pastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  rowWrap: {
    backgroundColor: theme.background.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border.default,
    marginBottom: spacing.sm,
  },
  accessory: { alignItems: 'flex-end', gap: 4 },
  timestamp: { ...typography.caption, color: theme.text.muted },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.semantic.danger },

  activityRow: {
    flexDirection: 'row',
    gap: spacing.md,
    backgroundColor: theme.background.surface,
    borderRadius: radius.lg,
    padding: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border.default,
    marginBottom: spacing.sm,
  },
  // A new message in a group chat should be obviously different at a
  // glance, not just a small dot easy to miss while scanning the list.
  activityRowUnread: {
    backgroundColor: theme.brand.primaryTint,
    borderColor: theme.brand.primary,
    borderWidth: 1.5,
  },
  // Fixed width only — CoverFrame supplies the 4:3 height and clipping, so
  // this tile can never grow the chat row's height.
  activityThumb: {
    width: 64,
    backgroundColor: theme.brand.accentTint,
  },
  activityThumbFill: { flex: 1 },
  activityBody: { flex: 1, justifyContent: 'center', gap: 2 },
  activityTitleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  activityTitle: { ...typography.bodyMedium, color: theme.text.primary, flexShrink: 1 },
  unreadText: { fontFamily: typography.bodyMedium.fontFamily, color: theme.text.primary },
  activityMeta: { ...typography.footnote, color: theme.text.secondary },
  activityFooterLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  activityPreview: { ...typography.footnote, color: theme.text.muted, flex: 1, marginRight: spacing.sm },
  activityFooterRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  activityCount: { ...typography.caption, color: theme.text.muted, marginRight: spacing.xs },
});
