import React from 'react';
import { View, StyleSheet } from 'react-native';
import { theme, spacing, radius } from '@/theme';

interface StepProgressProps {
  step: number; // 0-indexed
  total: number;
}

export function StepProgress({ step, total }: StepProgressProps) {
  return (
    <View style={styles.row}>
      {Array.from({ length: total }).map((_, index) => (
        <View
          key={index}
          style={[styles.segment, index <= step && styles.segmentActive]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xs },
  segment: {
    flex: 1,
    height: 4,
    borderRadius: radius.pill,
    backgroundColor: theme.border.default,
  },
  segmentActive: { backgroundColor: theme.brand.primary },
});
