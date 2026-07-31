import React, { useMemo, useState } from 'react';
import { View, Text, SectionList, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatCircleDots, CaretDown, CaretUp, UsersThree } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { StateCard } from '@/components/StateCard';
import { PersonCard } from '@/components/PersonCard';
import { CoverImage } from '@/components/CoverImage';
import { useConversations, type Conversation } from '@/hooks/useConversations';
import { formatRelativeTime } from '@/utils/formatRelativeTime';
import { formatStartTime } from '@/utils/formatStartTime';
import { CATEGORY_LABELS } from '@/types/activity';
import { groupConversations } from '@/utils/groupConversations';

interface MessagesScreenProps {
  onOpenConversation: (conversation: Conversation) => void;
}

type Section = { key: 'upcoming' | 'direct' | 'past'; title: string; data: Conversation[] };

/** The Chats tab — activity group chats grouped into "my upcoming plans"
 *  and a quieter, collapsed-by-default past archive, plus a standing
 *  section for person-to-person direct chats (not activity-dated, so they
 *  don't fit either bucket). This reads as "my upcoming communities and
 *  plans," not a generic flat inbox. */
export function MessagesScreen({ onOpenConversation }: MessagesScreenProps) {
  const { conversations, isLoading, error, refresh } = useConversations();
  const [pastOpen, setPastOpen] = useState(false);

  const sections = useMemo<Section[]>(() => {
    const { upcoming, past, direct } = groupConversations(conversations);

    const result: Section[] = [];
    if (upcoming.length > 0) result.push({ key: 'upcoming', title: 'Upcoming activities', data: upcoming });
    if (direct.length > 0) result.push({ key: 'direct', title: 'Direct messages', data: direct });
    if (past.length > 0) result.push({ key: 'past', title: 'Past activities', data: pastOpen ? past : [] });
    return result;
  }, [conversations, pastOpen]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Text style={styles.headerTitle}>Chats</Text>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.chatId}
        contentContainerStyle={conversations.length === 0 ? styles.emptyContent : styles.listContent}
        stickySectionHeadersEnabled={false}
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
          !isLoading ? (
            <StateCard
              icon={ChatCircleDots}
              title={error ? "Couldn't load your messages." : 'No conversations yet'}
              body={error ? 'Tap below to try again.' : 'Join or host an activity to start chatting.'}
              ctaLabel={error ? 'Try again' : undefined}
              onCtaPress={error ? refresh : undefined}
              tone={error ? 'warning' : 'default'}
            />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

function ActivityConversationRow({ conversation, onPress }: { conversation: Conversation; onPress: () => void }) {
  const activity = conversation.activity!;
  return (
    <Pressable style={styles.activityRow} onPress={onPress} accessibilityRole="button">
      <View style={styles.activityThumb}>
        <CoverImage url={activity.coverImageUrl} fallbackCategory={activity.category} style={styles.activityThumbFill} />
      </View>
      <View style={styles.activityBody}>
        <View style={styles.activityTitleLine}>
          <Text style={[styles.activityTitle, conversation.hasUnread && styles.unreadText]} numberOfLines={1}>
            {conversation.title}
          </Text>
          {conversation.hasUnread && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.activityMeta} numberOfLines={1}>
          {CATEGORY_LABELS[activity.category] ?? CATEGORY_LABELS.other} · {formatStartTime(activity.startTime)} · {activity.locationLabel}
        </Text>
        <View style={styles.activityFooterLine}>
          <Text
            style={[styles.activityPreview, conversation.hasUnread && styles.unreadText]}
            numberOfLines={1}
          >
            {conversation.lastMessagePreview || 'Say hello 👋'}
          </Text>
          <View style={styles.activityFooterRight}>
            <UsersThree size={12} color={theme.text.muted} weight="bold" />
            <Text style={styles.activityCount}>{activity.attendeeCount}</Text>
            {conversation.lastMessageAt && (
              <Text style={styles.timestamp}>{formatRelativeTime(conversation.lastMessageAt)}</Text>
            )}
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
  activityThumb: {
    width: 56,
    height: 56,
    borderRadius: radius.md,
    overflow: 'hidden',
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
