import React from 'react';
import { View, Text, Image, Pressable, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ChatCircleDots } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { StateCard } from '@/components/StateCard';
import { useConversations, type Conversation } from '@/hooks/useConversations';

interface MessagesScreenProps {
  onBack: () => void;
  onOpenConversation: (conversation: Conversation) => void;
}

export function MessagesScreen({ onBack, onOpenConversation }: MessagesScreenProps) {
  const { conversations, isLoading, error, refresh } = useConversations();

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton} accessibilityLabel="Back">
          <ArrowLeft size={20} color={theme.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Messages</Text>
        <View style={styles.backButton} />
      </View>

      <FlatList
        data={conversations}
        keyExtractor={(item) => item.chatId}
        contentContainerStyle={conversations.length === 0 ? styles.emptyContent : styles.listContent}
        refreshing={isLoading}
        onRefresh={refresh}
        renderItem={({ item }) => <ConversationRow conversation={item} onPress={() => onOpenConversation(item)} />}
        ListEmptyComponent={
          !isLoading ? (
            <StateCard
              icon={ChatCircleDots}
              title={error ?? 'No conversations yet'}
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
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.avatar}>
        {conversation.avatarUrl ? (
          <Image source={{ uri: conversation.avatarUrl }} style={StyleSheet.absoluteFill} />
        ) : (
          <Text style={styles.avatarInitial}>{conversation.title[0]?.toUpperCase() ?? '?'}</Text>
        )}
      </View>
      <View style={styles.rowBody}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {conversation.title}
        </Text>
        <Text style={styles.rowPreview} numberOfLines={1}>
          {conversation.subtitle}
        </Text>
      </View>
      {conversation.hasUnread && <View style={styles.unreadDot} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background.app },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.background.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...typography.headline, color: theme.text.primary },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing['4xl'], gap: spacing.sm },
  emptyContent: { flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: theme.background.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border.default,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: radius.pill,
    backgroundColor: theme.brand.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarInitial: { ...typography.headline, color: theme.text.accent },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { ...typography.bodyMedium, color: theme.text.primary },
  rowPreview: { ...typography.footnote, color: theme.text.secondary },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.semantic.danger },
});
