import React from 'react';
import { View, Text, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChatCircleDots, UsersThree, User } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { StateCard } from '@/components/StateCard';
import { PersonCard } from '@/components/PersonCard';
import { useConversations, type Conversation } from '@/hooks/useConversations';
import { formatRelativeTime } from '@/utils/formatRelativeTime';

interface MessagesScreenProps {
  onOpenConversation: (conversation: Conversation) => void;
}

/** The Chats tab -- one unified inbox for activity group chats and direct
 *  chats. No separate "direct messages" screen exists anywhere else. */
export function MessagesScreen({ onOpenConversation }: MessagesScreenProps) {
  const { conversations, isLoading, error, refresh } = useConversations();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Text style={styles.headerTitle}>Chats</Text>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.chatId}
        contentContainerStyle={conversations.length === 0 ? styles.emptyContent : styles.listContent}
        renderItem={({ item }) => <ConversationRow conversation={item} onPress={() => onOpenConversation(item)} />}
        ListEmptyComponent={
          !isLoading ? (
            <StateCard
              icon={ChatCircleDots}
              title={error ?? 'No messages yet'}
              body={
                error
                  ? 'Pull down to try again.'
                  : "When you join or host an activity, you'll be able to chat with everyone here."
              }
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

function ConversationRow({ conversation, onPress }: { conversation: Conversation; onPress: () => void }) {
  const KindIcon = conversation.kind === 'group' ? UsersThree : User;
  return (
    <View style={styles.rowWrap}>
      <PersonCard
        size="row"
        name={conversation.title}
        avatarUrl={conversation.avatarUrl}
        subtitle={conversation.subtitle}
        onPress={onPress}
        badge={
          <View style={styles.kindBadge}>
            <KindIcon size={10} color={theme.text.muted} weight="bold" />
          </View>
        }
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
  rowWrap: {
    backgroundColor: theme.background.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border.default,
  },
  kindBadge: {
    width: 16,
    height: 16,
    borderRadius: radius.sm,
    backgroundColor: theme.background.app,
    alignItems: 'center',
    justifyContent: 'center',
  },
  accessory: { alignItems: 'flex-end', gap: 4 },
  timestamp: { ...typography.caption, color: theme.text.muted },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.semantic.danger },
});
