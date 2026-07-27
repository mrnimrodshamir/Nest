import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, PressableProps } from 'react-native';
import { theme, typography, spacing, radius } from '@/theme';

interface PrimaryButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'outline';
}

export function PrimaryButton({
  label,
  loading = false,
  variant = 'primary',
  disabled,
  ...pressableProps
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <Pressable
      style={[
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'outline' && styles.buttonOutline,
        isDisabled && styles.buttonDisabled,
      ]}
      disabled={isDisabled}
      {...pressableProps}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? theme.text.primary : theme.text.inverse} />
      ) : (
        <Text
          style={[
            styles.label,
            variant === 'outline' && styles.labelOutline,
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: theme.brand.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
  },
  buttonSecondary: { backgroundColor: theme.brand.secondary },
  buttonOutline: {
    backgroundColor: theme.background.surface,
    borderWidth: 1,
    borderColor: theme.border.strong,
  },
  buttonDisabled: { opacity: 0.5 },
  label: { ...typography.bodyMedium, color: theme.text.inverse },
  labelOutline: { color: theme.text.primary },
});
