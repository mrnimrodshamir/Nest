import React from 'react';
import { Pressable, Text, StyleSheet } from 'react-native';
import { theme, typography, spacing, radius } from '@/theme';

interface CategoryChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export function CategoryChip({ label, selected, onPress }: CategoryChipProps) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.chip, selected && styles.chipSelected]}
      accessibilityRole="button"
      accessibilityState={{ selected }}
    >
      <Text style={[styles.label, selected && styles.labelSelected]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: theme.background.app,
    marginRight: spacing.sm,
  },
  chipSelected: {
    backgroundColor: theme.brand.primary,
  },
  label: {
    ...typography.subhead,
    fontWeight: '500' as const,
    color: theme.text.primary,
  },
  labelSelected: {
    color: theme.text.inverse,
    fontWeight: '600' as const,
  },
});
