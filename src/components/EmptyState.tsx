import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme, typography, spacing, radius } from '@/theme';

interface EmptyStateProps {
  /** true once we've already silently widened the search radius and still found nothing */
  radiusExpanded: boolean;
  onHostPress: () => void;
}

/**
 * Design intent: Discover must never dead-end on "nothing here." By the time
 * this renders, DiscoverScreen has already retried with a wider radius —
 * this is the true floor. It reframes sparse density as an opportunity
 * ("be the first") rather than a failure, and gives one clear action.
 */
export function EmptyState({ radiusExpanded, onHostPress }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <View style={styles.iconCircle} />
      <Text style={styles.title}>
        {radiusExpanded ? 'Be the first here' : 'Nothing nearby just yet'}
      </Text>
      <Text style={styles.body}>
        {radiusExpanded
          ? 'No one has hosted near you yet — the easiest way to meet mothers close by is to start something small yourself.'
          : "We're widening your search radius to find something for you."}
      </Text>
      {radiusExpanded && (
        <Pressable style={styles.cta} onPress={onHostPress}>
          <Text style={styles.ctaLabel}>Host an activity</Text>
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
    marginBottom: spacing.xl,
  },
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
