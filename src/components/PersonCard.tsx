import React from 'react';
import { View, Text, Image, Pressable, StyleSheet } from 'react-native';
import { theme, typography, spacing, radius } from '@/theme';

export type PersonCardSize = 'compact' | 'row' | 'hero';

interface PersonCardProps {
  name: string;
  avatarUrl: string | null;
  /** e.g. "Mom of Yuval · 8 months", "Hosting", a chat's last-message preview. */
  subtitle?: string;
  size?: PersonCardSize;
  onPress?: () => void;
  /** Small tag rendered next to the name, e.g. a "Hosting"/"Going" role pill. */
  badge?: React.ReactNode;
  /** Right-aligned accessory on `row` size — e.g. "Message" link, a timestamp, an unread dot. */
  accessoryRight?: React.ReactNode;
  accessibilityLabel?: string;
}

/** The one component for every place a person appears in the app: host
 *  rows, attendee avatars, chat inbox rows, and the Public Profile header.
 *  `compact` is a bare tappable avatar (attendee stacks); `row` is
 *  avatar+name+subtitle in a horizontal line (host row, chat inbox); `hero`
 *  is the large centered header used at the top of a Public Profile.
 *  No trust score, ranking, or badge shelf lives here by design — only a
 *  name, a photo (or a branded initial, never an illustrated face), and an
 *  optional plain-text subtitle. */
export function PersonCard({
  name,
  avatarUrl,
  subtitle,
  size = 'row',
  onPress,
  badge,
  accessoryRight,
  accessibilityLabel,
}: PersonCardProps) {
  const initial = name[0]?.toUpperCase() ?? '?';

  if (size === 'compact') {
    return (
      <Pressable
        onPress={onPress}
        disabled={!onPress}
        accessibilityLabel={accessibilityLabel ?? name}
        accessibilityRole={onPress ? 'button' : undefined}
        hitSlop={4}
        style={styles.compactAvatar}
      >
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={StyleSheet.absoluteFill} />
        ) : (
          <Text style={styles.compactInitial}>{initial}</Text>
        )}
      </Pressable>
    );
  }

  if (size === 'hero') {
    return (
      <Pressable onPress={onPress} disabled={!onPress} style={styles.heroContainer}>
        <View style={styles.heroAvatar}>
          {avatarUrl ? (
            <Image source={{ uri: avatarUrl }} style={StyleSheet.absoluteFill} />
          ) : (
            <Text style={styles.heroInitial}>{initial}</Text>
          )}
        </View>
        <View style={styles.heroNameRow}>
          <Text style={styles.heroName}>{name}</Text>
          {badge}
        </View>
        {subtitle ? <Text style={styles.heroSubtitle}>{subtitle}</Text> : null}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      style={styles.rowContainer}
    >
      <View style={styles.rowAvatar}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={StyleSheet.absoluteFill} />
        ) : (
          <Text style={styles.rowInitial}>{initial}</Text>
        )}
      </View>
      <View style={styles.rowBody}>
        <View style={styles.rowNameLine}>
          <Text style={styles.rowName} numberOfLines={1}>
            {name}
          </Text>
          {badge}
        </View>
        {subtitle ? (
          <Text style={styles.rowSubtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {accessoryRight}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // compact
  compactAvatar: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: theme.brand.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: theme.background.surface,
  },
  compactInitial: { ...typography.footnote, fontWeight: '700' as const, color: theme.text.accent },

  // row
  rowContainer: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 },
  rowAvatar: {
    width: 44,
    height: 44,
    borderRadius: radius.pill,
    backgroundColor: theme.brand.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  rowInitial: { ...typography.bodyMedium, color: theme.text.accent },
  rowBody: { flex: 1, gap: 2 },
  rowNameLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  rowName: { ...typography.bodyMedium, color: theme.text.primary, flexShrink: 1 },
  rowSubtitle: { ...typography.footnote, color: theme.text.secondary },

  // hero
  heroContainer: { alignItems: 'center', gap: 4 },
  heroAvatar: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    backgroundColor: theme.brand.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  heroInitial: { ...typography.display, fontSize: 32, color: theme.text.accent },
  heroNameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  heroName: { ...typography.title2, color: theme.text.primary },
  heroSubtitle: { ...typography.subhead, color: theme.text.secondary },
});
