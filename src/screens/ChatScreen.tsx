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
import { resolveBubbleRow, resolveSenderNameAlignment } from '@/utils/chatBubbleLayout';
import { useI18n } from '@/i18n';

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
  const { t } = useI18n();
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const handleSend = () => {
    if (!draft.trim()) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    send(draft);
    setDraft('');
  };

  return (
    // Chats are English-only content and must read LTR on any device
    // locale. This subtree-level `direction: 'ltr'` is a defence-in-depth
    // layer only — it is NOT what positions the bubbles, because a style
    // on this third-party native view did not reliably reach the
    // descendant Yoga nodes on a real Hebrew-locale device. The bubble
    // side is decided structurally by a flexible spacer in MessageBubble
    // (see utils/chatBubbleLayout.ts), which cannot be mirrored.
    <SafeAreaView style={[styles.container, styles.forceLtr]} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel={t('common.back')}>
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
                  <Text style={styles.emptyTitle}>{t('chats.noMessagesYet')}</Text>
                  <Text style={styles.emptyBody}>{t('chat.conversationStart')}</Text>
                </View>
              }
            />
          )}

          {error && <Text style={styles.error}>{error}</Text>}

          <View style={styles.inputRow}>
            <TextInput
              style={styles.input}
              placeholder={t('chat.messagePlaceholder')}
              placeholderTextColor={theme.text.muted}
              value={draft}
              onChangeText={setDraft}
              multiline
            />
            <Pressable style={styles.sendButton} onPress={handleSend} accessibilityRole="button" accessibilityLabel={t('chat.send')}>
              <PaperPlaneTilt size={18} color={theme.text.inverse} weight="fill" />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

function MessageBubble({ message, onRetry }: { message: ChatMessage; onRetry: () => void }) {
  const { t } = useI18n();
  const row = resolveBubbleRow(message.isMine);
  const nameAlign = resolveSenderNameAlignment(message.isMine);

  // EVERY message — incoming and own — is left-positioned; only the bubble
  // colour distinguishes the current user. The position comes from a
  // trailing flexible spacer, NOT from alignItems/alignSelf, because those
  // are direction-relative and resolve to the wrong edge under a Hebrew
  // device locale. See utils/chatBubbleLayout.ts.
  return (
    <View style={styles.bubbleRow}>
      {row.spacerBefore && <View style={styles.bubbleSpacer} />}
      <View style={styles.bubbleColumn}>
        <Text style={[styles.senderName, nameAlign]}>{message.senderName}</Text>
        <View style={[styles.bubble, message.isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
          <Text style={[styles.bubbleText, message.isMine && styles.bubbleTextMine]}>
            {message.content}
          </Text>
        </View>
        {message.failed && (
          <Pressable onPress={onRetry} style={styles.retryRow} hitSlop={10}>
            <WarningCircle size={12} color={theme.semantic.danger} weight="fill" />
            <Text style={styles.retryLabel}>{t('chat.notSent')}</Text>
          </Pressable>
        )}
      </View>
      {row.spacerAfter && <View style={styles.bubbleSpacer} />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background.app },
  forceLtr: { direction: 'ltr' },
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
  // `direction: 'ltr'` is pinned on the row node itself rather than only
  // inherited from the SafeAreaView — inheritance had to cross a
  // third-party native view to reach here, which is why it failed on device.
  bubbleRow: {
    flexDirection: 'row',
    direction: 'ltr',
    width: '100%',
    marginBottom: spacing.xs,
  },
  // The growing spacer is what physically decides the side. It sits before
  // the column for own messages and after it for incoming ones.
  bubbleSpacer: { flex: 1 },
  // Caps bubble width without needing maxWidth on the bubble itself, so the
  // spacer always has room to do its job.
  bubbleColumn: { maxWidth: '80%' },
  senderName: {
    ...typography.caption,
    color: theme.text.muted,
    marginBottom: 2,
    marginHorizontal: spacing.sm,
    writingDirection: 'ltr',
  },
  bubble: {
    borderRadius: radius.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  // Own messages are distinguished by COLOUR ONLY — both sit on the left,
  // so both use the same left-anchored tail corner.
  bubbleTheirs: { backgroundColor: theme.background.surface, borderBottomLeftRadius: radius.sm },
  bubbleMine: { backgroundColor: theme.brand.primary, borderBottomLeftRadius: radius.sm },
  bubbleText: { ...typography.body, color: theme.text.primary, textAlign: 'left', writingDirection: 'ltr' },
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
