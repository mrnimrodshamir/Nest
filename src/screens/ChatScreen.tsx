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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, PaperPlaneTilt } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { useActivityChat, type ChatMessage } from '@/hooks/useActivityChat';

interface ChatScreenProps {
  activityId: string;
  activityTitle: string;
  onBack: () => void;
}

export function ChatScreen({ activityId, activityTitle, onBack }: ChatScreenProps) {
  const { messages, isLoading, error, send } = useActivityChat(activityId);
  const [draft, setDraft] = useState('');
  const listRef = useRef<FlatList<ChatMessage>>(null);

  const handleSend = () => {
    if (!draft.trim()) return;
    send(draft);
    setDraft('');
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton} accessibilityLabel="Back">
          <ArrowLeft size={20} color={theme.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>{activityTitle}</Text>
        <View style={styles.backButton} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
      >
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.messageList}
          renderItem={({ item }) => <MessageBubble message={item} />}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
          ListEmptyComponent={
            !isLoading ? (
              <View style={styles.emptyState}>
                <Text style={styles.emptyTitle}>Say hello 👋</Text>
                <Text style={styles.emptyBody}>
                  This chat is just for people joining {activityTitle}.
                </Text>
              </View>
            ) : null
          }
        />

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
    </SafeAreaView>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  return (
    <View style={[styles.bubbleRow, message.isMine && styles.bubbleRowMine]}>
      {!message.isMine && <Text style={styles.senderName}>{message.senderName}</Text>}
      <View style={[styles.bubble, message.isMine ? styles.bubbleMine : styles.bubbleTheirs]}>
        <Text style={[styles.bubbleText, message.isMine && styles.bubbleTextMine]}>
          {message.content}
        </Text>
      </View>
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
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.background.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...typography.headline, color: theme.text.primary, flex: 1, textAlign: 'center', marginHorizontal: spacing.sm },
  messageList: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  bubbleRow: { alignItems: 'flex-start', marginBottom: spacing.xs },
  bubbleRowMine: { alignItems: 'flex-end' },
  senderName: { ...typography.caption, color: theme.text.muted, marginBottom: 2, marginLeft: spacing.sm },
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
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: theme.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
