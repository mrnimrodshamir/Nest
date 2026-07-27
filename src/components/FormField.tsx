import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { theme, typography, spacing, radius } from '@/theme';

interface FormFieldProps extends TextInputProps {
  label: string;
  error?: string | null;
}

export function FormField({ label, error, style, ...inputProps }: FormFieldProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[styles.input, error ? styles.inputError : null, style]}
        placeholderTextColor={theme.text.muted}
        {...inputProps}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: { ...typography.footnote, color: theme.text.secondary },
  input: {
    ...typography.body,
    backgroundColor: theme.background.surface,
    borderWidth: 1,
    borderColor: theme.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: theme.text.primary,
  },
  inputError: { borderColor: theme.semantic.danger },
  error: { ...typography.caption, color: theme.semantic.danger },
});
