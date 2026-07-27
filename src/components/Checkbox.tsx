import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { Check } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';

interface CheckboxProps {
  checked: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function Checkbox({ checked, onToggle, children }: CheckboxProps) {
  return (
    <Pressable style={styles.row} onPress={onToggle} accessibilityRole="checkbox" accessibilityState={{ checked }}>
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked && <Check size={13} color={theme.text.inverse} weight="bold" />}
      </View>
      <Text style={styles.label}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  box: {
    width: 22,
    height: 22,
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: theme.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  boxChecked: { backgroundColor: theme.brand.primary, borderColor: theme.brand.primary },
  label: { ...typography.footnote, color: theme.text.secondary, flex: 1, lineHeight: 18 },
});
