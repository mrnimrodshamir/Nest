import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Minus, Plus } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';

interface NumberStepperProps {
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

export function NumberStepper({ value, min, max, onChange }: NumberStepperProps) {
  return (
    <View style={styles.controls}>
      <Pressable
        style={styles.button}
        hitSlop={6}
        onPress={() => onChange(Math.max(min, value - 1))}
        accessibilityLabel="Decrease"
      >
        <Minus size={16} color={theme.text.primary} weight="bold" />
      </Pressable>
      <Text style={styles.value}>{value}</Text>
      <Pressable
        style={styles.button}
        hitSlop={6}
        onPress={() => onChange(Math.min(max, value + 1))}
        accessibilityLabel="Increase"
      >
        <Plus size={16} color={theme.text.primary} weight="bold" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.background.surface,
    borderWidth: 1,
    borderColor: theme.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    width: 140,
  },
  button: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    backgroundColor: theme.background.app,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: { ...typography.headline, color: theme.text.primary, minWidth: 28, textAlign: 'center' },
});
