import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import type { Icon } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';

interface StateCardProps {
  icon: Icon;
  title: string;
  body: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
  tone?: 'default' | 'warning';
}

/** Generic premium empty/error/offline state — used across Discover for
 *  every non-happy-path (no results, no nearby activities, location
 *  disabled, offline, error). Deliberately avoids generic system copy
 *  ("Something went wrong", "No data") in favor of specific, human
 *  language at each call site. */
export function StateCard({ icon: IconComponent, title, body, ctaLabel, onCtaPress, tone = 'default' }: StateCardProps) {
  return (
    <View style={styles.container}>
      <View style={[styles.iconCircle, tone === 'warning' && styles.iconCircleWarning]}>
        <IconComponent
          size={26}
          color={tone === 'warning' ? theme.semantic.warning : theme.brand.secondary}
          weight="duotone"
        />
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.body}>{body}</Text>
      {ctaLabel && onCtaPress && (
        <Pressable style={styles.cta} onPress={onCtaPress}>
          <Text style={styles.ctaLabel}>{ctaLabel}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingHorizontal: spacing['3xl'],
    paddingTop: spacing['5xl'],
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.pill,
    backgroundColor: theme.brand.secondaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  iconCircleWarning: { backgroundColor: theme.semantic.warningTint },
  title: {
    ...typography.title3,
    color: theme.text.primary,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  body: {
    ...typography.subhead,
    color: theme.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  cta: {
    backgroundColor: theme.brand.secondary,
    borderRadius: radius.md,
    paddingHorizontal: spacing['2xl'],
    paddingVertical: spacing.md,
  },
  ctaLabel: {
    ...typography.bodyMedium,
    color: theme.text.inverse,
  },
});
