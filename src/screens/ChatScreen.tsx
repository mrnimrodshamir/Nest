import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ArrowLeft, PaperPlaneTilt, WarningCircle } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { useChatMessages, type ChatMessage } from '@/hooks/useChatMessages';

interface ChatScreenProps {
  /** Null while still resolving (or being created) — shows a loading state. */
  chatId: string | null;
  /** Set if chatId resolution itself failed (e.g. no shared activity yet). */
  resolveError?: string | null;
  title: string;
  onBack: () => void;
}

export function ChatScreen({ chatId, resolveError, title, onBack }: ChatScreenProps) {
  const { messages, isLoading, error, send, retry } = useChatMessages(chatId);
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const handleSend = () => {
    if (!draft.trim()) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    send(draft);
    setDraft('');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton} accessibilityLabel="Back">
          <ArrowLeft size={20} color={theme.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{title}</Text>
        <View style={styles.backButton} />
      </View>

      {resolveError ? (
        <View style={styles.centerState}>
          <WarningCircle size={28} color={theme.text.muted} />
          <Text style={styles.centerStateText}>{resolveError}</Text>
        </View>
      ) : !chatId ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={theme.brand.primary} />
        </View>
      ) : (
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
          {isLoading && messages.length === 0 ? (
            <View style={styles.centerState}>
              <ActivityIndicator color={theme.brand.primary} />
            </View>
          ) : (
            <FlatList
              ref={listRef}
              data={messages}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.messageList}
              renderItem={({ item }) => <MessageBubble message={item} onRetry={() => retry(item.id)} />}
              onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyTitle}>Say hello 👋</Text>
                  <Text style={styles.emptyBody}>This is the start of your conversation.</Text>
                </View>
              }
            />
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder="Message"
              placeholderTextColor={theme.text.muted}
              value={draft}
              onChangeText={setDraft}
              multiline
            />
            <Pressable style={styles.sendButton} onPress={handleSend} accessibilityLabel="Send">
              <PaperPlaneTilt size={18} color={theme.text.inverse} weight="fill" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

function MessageBubble({ message, onRetry }: { message: ChatMessage; onRetry: () => void }) {
  return (
    <View style={[styles.bubbleRow, message.isMine && styles.bubbleRowMine]}>
      <Text style={[styles.senderName, message.isMine && styles.senderNameMine]}>
        {message.senderName}
      </Text>
      <View style={[styles.bubble, message.isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={[styles.bubbleText, message.isMine && styles.bubbleTextMine]}>
          {message.content}
        </Text>
      </View>
      {message.failed && (
        <Pressable onPress={onRetry} style={styles.retryRow} hitSlop={10}>
          <WarningCircle size={12} color={theme.semantic.danger} weight="fill" />
          <Text style={styles.retryLabel}>Not sent — tap to retry</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background.app },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.background.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...typography.headline, color: theme.text.primary, flex: 1, textAlign: 'center', marginHorizontal: spacing.sm },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing['2xl'] },
  centerStateText: { ...typography.subhead, color: theme.text.secondary, textAlign: 'center' },
  messageList: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  bubbleRow: { alignItems: 'flex-start', marginBottom: spacing.xs },
  bubbleRowMine: { alignItems: 'flex-end' },
  senderName: { ...typography.caption, color: theme.text.muted, marginBottom: 2, marginLeft: spacing.sm },
  senderNameMine: { marginLeft: 0, marginRight: spacing.sm },
  bubble: {
    maxWidth: '80%',
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  bubbleTheirs: { backgroundColor: theme.background.surface, borderBottomLeftRadius: radius.sm },
  bubbleMine: { backgroundColor: theme.brand.primary, borderBottomRightRadius: radius.sm },
  bubbleText: { ...typography.body, color: theme.text.primary },
  bubbleTextMine: { color: theme.text.inverse },
  retryRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  retryLabel: { ...typography.caption, color: theme.semantic.danger },
  emptyState: { alignItems: 'center', paddingTop: spacing['4xl'], paddingHorizontal: spacing['2xl'] },
  emptyTitle: { ...typography.title3, color: theme.text.primary, marginBottom: spacing.sm },
  emptyBody: { ...typography.subhead, color: theme.text.secondary, textAlign: 'center' },
  error: { ...typography.caption, color: theme.semantic.danger, textAlign: 'center', paddingBottom: spacing.xs },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border.default,
  },
  input: {
    flex: 1,
    ...typography.body,
    backgroundColor: theme.background.surface,
    borderWidth: 1,
    borderColor: theme.border.default,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    maxHeight: 100,
    color: theme.text.primary,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: theme.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
