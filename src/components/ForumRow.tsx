import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { ChatsCircle } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { useI18n, textAlignForContent } from '@/i18n';
import { formatRelativeTime } from '@/utils/formatRelativeTime';
import type { ForumSummary } from '@/hooks/useForums';

/** A permanent community space.
 *
 *  Styled deliberately unlike an activity chat row: a tinted round icon rather
 *  than a photo thumbnail, and a standing description instead of a date and
 *  location. A forum is always there; an activity chat is a one-time thing
 *  with a time and a place, and the two must not read as the same object. */
export function ForumRow({ forum, onPress }: { forum: ForumSummary; onPress: () => void }) {
  const { t, locale } = useI18n();
  const title = t(forum.titleKey);
  const description = t(forum.descriptionKey);

  const preview = forum.lastMessagePreview
    ? forum.lastMessageSenderName
      ? `${forum.lastMessageSenderName}: ${forum.lastMessagePreview}`
      : forum.lastMessagePreview
    : null;

  // The preview is user-written and may be in either language regardless of
  // the UI locale, so it follows its own script rather than the interface's.
  const previewDirection = textAlignForContent(preview, locale);

  return (
    <Pressable
      style={[styles.row, forum.hasUnread && styles.rowUnread]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={description}
    >
      <View style={styles.icon}>
        <ChatsCircle size={22} color={theme.brand.primary} weight="fill" />
      </View>

      <View style={styles.body}>
        <View style={styles.titleLine}>
          <Text style={[styles.title, forum.hasUnread && styles.unreadText]} numberOfLines={1}>
            {title}
          </Text>
          {forum.hasUnread ? <View style={styles.unreadDot} /> : null}
        </View>

        {/* The standing description is what makes a forum legible before it
            has any messages — it never gets replaced by the preview. */}
        <Text style={styles.description} numberOfLines={1}>
          {description}
        </Text>

        {preview ? (
          <View style={styles.footerLine}>
            <Text style={[styles.preview, previewDirection]} numberOfLines={1}>
              {preview}
            </Text>
            {forum.lastMessageAt ? (
              <Text style={styles.time}>{formatRelativeTime(forum.lastMessageAt)}</Text>
            ) : null}
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    // Comfortably above the 44pt minimum even with one line of content.
    minHeight: 72,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: theme.background.surface,
    borderRadius: radius.lg,
    marginBottom: spacing.xs,
  },
  rowUnread: { backgroundColor: theme.brand.primaryTint },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.brand.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // flexShrink lets long forum names truncate instead of pushing the time
  // off the row on a small screen.
  body: { flex: 1, flexShrink: 1 },
  titleLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  title: { ...typography.bodyMedium, color: theme.text.primary, flexShrink: 1 },
  unreadText: { fontWeight: '700' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.brand.primary },
  description: { ...typography.caption, color: theme.text.secondary, marginTop: 1 },
  footerLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: 2 },
  preview: { ...typography.caption, color: theme.text.muted, flex: 1 },
  time: { ...typography.caption, color: theme.text.muted },
});
