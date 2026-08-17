import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, SectionList, TextInput, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ChatCircleDots, UsersThree, Plus, MagnifyingGlass, X } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { StateCard } from '@/components/StateCard';
import { PersonCard } from '@/components/PersonCard';
import { CoverImage } from '@/components/CoverImage';
import { CoverFrame } from '@/components/CoverFrame';
import { useConversations, type Conversation } from '@/hooks/useConversations';
import { formatRelativeTime } from '@/utils/formatRelativeTime';
import { formatExactStartTime } from '@/utils/formatExactStartTime';
import { groupConversations } from '@/utils/groupConversations';
import { resolveChatsUpcomingState } from '@/utils/resolveChatsUpcomingState';
import { chatSections, filterForums, partitionForums, type ChatSectionKey } from '@/utils/chatSections';
import { useForums, type ForumSummary } from '@/hooks/useForums';
import { ForumRow } from '@/components/ForumRow';
import { activityCategoryLabel, isolateText, useI18n, textAlignForContent } from '@/i18n';
import { track } from '@/lib/analytics';

interface MessagesScreenProps {
  onOpenConversation: (conversation: Conversation) => void;
  onOpenForum: (forum: ForumSummary) => void;
  onCreateActivity: () => void;
}

type Section = { key: 'upcoming' | 'direct' | 'past'; title: string; data: Conversation[] };

/** The Chats tab, split into three clearly separate spaces:
 *
 *    Chats      — live activity chats and direct messages
 *    Past Chats — activity chats whose activity is over, kept readable
 *    Forums     — permanent NestUp community spaces, not tied to an activity
 *
 *  The three are segmented rather than stacked because they answer different
 *  questions ("what's happening", "what happened", "where do I ask"), and
 *  because mixing standing community spaces into dated activity chats was
 *  exactly the confusion this structure removes. */
export function MessagesScreen({ onOpenConversation, onOpenForum, onCreateActivity }: MessagesScreenProps) {
  const { conversations, isLoading, error, refresh } = useConversations();
  const { forums, isLoading: forumsLoading, error: forumsError, refresh: refreshForums } = useForums();
  const { t, locale } = useI18n();
  // Section choice and search text live in component state, which survives
  // navigating into a conversation and back (Chats stays mounted for the
  // session), so the user returns to the tab they left.
  const [tab, setTab] = useState<ChatSectionKey>('active');
  const [forumQuery, setForumQuery] = useState('');

  // Chats stays mounted for the whole session (a sibling tab under the
  // same root, not a fresh screen instance each visit) — without this,
  // useConversations only ever fetched once, on the very first time this
  // tab was shown, so a chat created for a brand-new activity while the
  // parent was elsewhere in the app never appeared until something else
  // forced a remount.
  useFocusEffect(
    useCallback(() => {
      track('chats_opened');
      refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const { upcoming, past, direct } = useMemo(() => groupConversations(conversations), [conversations]);
  const { active } = useMemo(() => chatSections(conversations), [conversations]);

  // Search matches the RESOLVED title/description, not the keys, so it works
  // identically in Hebrew and English.
  const matchingForums = useMemo(
    () => filterForums(forums, forumQuery, (forum) => ({ title: t(forum.titleKey), description: t(forum.descriptionKey) })),
    [forums, forumQuery, t],
  );
  const forumSections = useMemo(() => {
    const { pinned, rest } = partitionForums(matchingForums);
    // While searching, a flat list of matches reads better than two headed
    // groups over a handful of rows.
    if (forumQuery) return rest.length + pinned.length > 0 ? [{ title: '', data: [...pinned, ...rest] }] : [];
    const result: Array<{ title: string; data: ForumSummary[] }> = [];
    if (pinned.length > 0) result.push({ title: t('forum.pinned'), data: pinned });
    if (rest.length > 0) result.push({ title: t('forum.allForums'), data: rest });
    return result;
  }, [matchingForums, forumQuery, t]);

  const searchDirection = textAlignForContent(forumQuery, locale);
  const upcomingState = resolveChatsUpcomingState(upcoming.length, past.length);

  const sections = useMemo<Section[]>(() => {
    if (tab === 'past') {
      // Past is its own tab now, so it is always expanded — there is nothing
      // to collapse it away from.
      return past.length > 0 ? [{ key: 'past', title: t('chats.section.past'), data: past }] : [];
    }
    const result: Section[] = [];
    if (upcoming.length > 0) result.push({ key: 'upcoming', title: t('chats.section.active'), data: upcoming });
    if (direct.length > 0) result.push({ key: 'direct', title: t('chats.directChat'), data: direct });
    return result;
  }, [tab, upcoming, direct, past, t]);

  const TABS: Array<{ key: ChatSectionKey; label: string }> = [
    { key: 'active', label: t('chats.section.active') },
    { key: 'past', label: t('chats.section.past') },
    { key: 'forums', label: t('chats.section.forums') },
  ];

  if (tab === 'forums') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <Text style={styles.headerTitle}>{t('chats.section.forums')}</Text>
        <SegmentedTabs tabs={TABS} value={tab} onChange={setTab} />

        <View style={styles.searchRow}>
          <MagnifyingGlass size={16} color={theme.text.muted} />
          <TextInput
            style={[styles.searchInput, searchDirection]}
            placeholder={t('forum.searchPlaceholder')}
            placeholderTextColor={theme.text.muted}
            value={forumQuery}
            onChangeText={setForumQuery}
            returnKeyType="search"
            accessibilityLabel={t('forum.searchLabel')}
            // Follows what was typed, so a Hebrew query in an English UI (and
            // vice versa) is not reversed.
            textAlign={searchDirection.textAlign}
          />
          {forumQuery ? (
            <Pressable onPress={() => setForumQuery('')} hitSlop={10} accessibilityLabel={t('discovery.closeSearch')}>
              <X size={16} color={theme.text.secondary} />
            </Pressable>
          ) : null}
        </View>

        <SectionList
          sections={forumSections}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.listContent}
          stickySectionHeadersEnabled={false}
          renderSectionHeader={({ section }) =>
            // The "Pinned" heading is noise when a search has already
            // narrowed the list to a handful of rows.
            section.title ? <Text style={styles.sectionTitle}>{section.title}</Text> : null
          }
          renderItem={({ item }) => <ForumRow forum={item} onPress={() => onOpenForum(item)} />}
          // Forums are seeded, so an empty list means the load failed. Showing
          // a cheerful "no forums yet" would be a lie; retry is the only
          // honest affordance.
          ListEmptyComponent={
            forumsLoading ? null : forumQuery ? (
              // A search with no matches is a legitimate empty result — quite
              // different from the forum list failing to load.
              <StateCard icon={UsersThree} title={t('forum.noSearchResults')} body={t('forum.noSearchResultsBody')} />
            ) : (
              <StateCard
                icon={UsersThree}
                title={t('chats.error.forums')}
                body={t('discovery.empty.body')}
                ctaLabel={t('common.retry')}
                onCtaPress={refreshForums}
                tone="warning"
              />
            )
          }
        />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Text style={styles.headerTitle}>{t('chats.section.active')}</Text>
      <SegmentedTabs tabs={TABS} value={tab} onChange={setTab} />

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.chatId}
        contentContainerStyle={conversations.length === 0 ? styles.emptyContent : styles.listContent}
        stickySectionHeadersEnabled={false}
        // The "no upcoming activities" nudge belongs to the live tab only —
        // it answers "what do I do next", which the archive is not about.
        ListHeaderComponent={
          tab === 'active' && upcomingState !== 'has-upcoming' ? (
            <UpcomingEmptyState onCreateActivity={onCreateActivity} />
          ) : null
        }
        renderSectionHeader={({ section }) => <Text style={styles.sectionTitle}>{section.title}</Text>}
        renderItem={({ item }) =>
          item.activity ? (
            <ActivityConversationRow conversation={item} onPress={() => onOpenConversation(item)} past={tab === 'past'} />
          ) : (
            <DirectConversationRow conversation={item} onPress={() => onOpenConversation(item)} />
          )
        }
        ListEmptyComponent={
          isLoading ? null : error ? (
            <StateCard
              icon={ChatCircleDots}
              title={t('chats.error.load')}
              body={t('discovery.empty.body')}
              ctaLabel={t('common.retry')}
              onCtaPress={refresh}
              tone="warning"
            />
          ) : (
            // Only reached when the load succeeded and there genuinely is
            // nothing — never when it failed.
            <StateCard
              icon={ChatCircleDots}
              title={t(tab === 'past' ? 'chats.empty.past' : 'chats.empty.active')}
              body={t(tab === 'past' ? 'chats.empty.pastBody' : 'chats.empty.activeBody')}
            />
          )
        }
      />
    </SafeAreaView>
  );
}

/** Chats / Past Chats / Forums. A single row of three so the whole control
 *  fits a small iPhone without truncating any label. */
function SegmentedTabs({
  tabs,
  value,
  onChange,
}: {
  tabs: Array<{ key: ChatSectionKey; label: string }>;
  value: ChatSectionKey;
  onChange: (key: ChatSectionKey) => void;
}) {
  return (
    <View style={styles.segmented} accessibilityRole="tablist">
      {tabs.map((item) => {
        const selected = item.key === value;
        return (
          <Pressable
            key={item.key}
            style={[styles.segment, selected && styles.segmentSelected]}
            onPress={() => onChange(item.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={item.label}
          >
            <Text style={[styles.segmentLabel, selected && styles.segmentLabelSelected]} numberOfLines={1}>
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function UpcomingEmptyState({ onCreateActivity }: { onCreateActivity: () => void }) {
  const { t } = useI18n();
  return (
    <View style={styles.upcomingEmptyWrap}>
      <Text style={styles.sectionTitle}>{t('chats.upcomingTitle')}</Text>
      <View style={styles.upcomingEmptyCard}>
        <View style={styles.upcomingEmptyText}>
          <Text style={styles.upcomingEmptyTitle}>{t('chats.upcomingEmptyTitle')}</Text>
          <Text style={styles.upcomingEmptyBody}>{t('chats.upcomingEmptyBody')}</Text>
        </View>
        <Pressable
          style={styles.upcomingEmptyCta}
          onPress={onCreateActivity}
          accessibilityRole="button"
          accessibilityLabel={t('chats.createActivity')}
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
  past = false,
}: {
  conversation: Conversation;
  onPress: () => void;
  /** Renders the row subdued, so an archived chat cannot be mistaken for a
   *  live plan. It stays fully readable and openable. */
  past?: boolean;
}) {
  const { t, locale, isRTL } = useI18n();
  const activity = conversation.activity!;
  const timingLabel = formatExactStartTime(activity.startTime);
  const previewText = conversation.lastMessagePreview
    ? conversation.lastMessageSenderName
      ? `${isolateText(conversation.lastMessageSenderName)}: ${isolateText(conversation.lastMessagePreview)}`
      : conversation.lastMessagePreview
    : t('chats.sayHello');

  return (
    <Pressable
      style={[styles.activityRow, conversation.hasUnread && styles.activityRowUnread, past && styles.activityRowPast]}
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
          <Text style={[styles.activityTitle, textAlignForContent(conversation.title, locale), conversation.hasUnread && styles.unreadText]} numberOfLines={1}>
            {conversation.title}
          </Text>
          {conversation.hasUnread && <View style={styles.unreadDot} />}
        </View>
        {/* The activity's own scheduled time is the main time context for
            an activity chat — not when the last message happened to be
            sent, which competes with it and reads as "when this is". */}
        <Text style={[styles.activityMeta, isRTL && styles.rtlText]} numberOfLines={1}>
          {activityCategoryLabel(activity.category, t)} · {timingLabel} · {isolateText(activity.locationLabel)}
        </Text>
        <View style={styles.activityFooterLine}>
          <Text
            style={[styles.activityPreview, textAlignForContent(conversation.lastMessagePreview ?? previewText, locale), conversation.hasUnread && styles.unreadText]}
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
  segmented: {
    flexDirection: 'row',
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    padding: 3,
    borderRadius: radius.md,
    backgroundColor: theme.background.app,
    gap: 2,
  },
  segment: {
    // flex:1 splits the width three ways, so no label is clipped even on a
    // small iPhone; numberOfLines={1} keeps a long Hebrew label on one line.
    flex: 1,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    borderRadius: radius.sm,
  },
  segmentSelected: { backgroundColor: theme.background.surface },
  segmentLabel: { ...typography.footnote, color: theme.text.secondary },
  segmentLabelSelected: { color: theme.text.primary, fontWeight: '700' },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 44,
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: theme.background.surface,
  },
  // flex:1 keeps the field from pushing the clear button off a small screen.
  searchInput: { flex: 1, ...typography.body, color: theme.text.primary, paddingVertical: spacing.xs },
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
  // Archived chats read as finished, not active. Opacity rather than a
  // muted palette so the row stays fully legible and every child element
  // dims consistently.
  activityRowPast: { opacity: 0.72 },
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
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  activityFooterLine: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  activityPreview: { ...typography.footnote, color: theme.text.muted, flex: 1, marginEnd: spacing.sm },
  activityFooterRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  activityCount: { ...typography.caption, color: theme.text.muted, marginEnd: spacing.xs },
});
