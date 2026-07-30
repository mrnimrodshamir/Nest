import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, PressableProps } from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme, typography, spacing, radius } from '@/theme';

interface StaticPrimaryButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'outline';
}

/** Non-Reanimated counterpart to PrimaryButton (src/components/PrimaryButton.tsx)
 *  — same visual API and appearance, but zero Reanimated: no shared
 *  value, no useAnimatedStyle, no press-feedback spring, no
 *  Animated.createAnimatedComponent. Used by every auth/onboarding
 *  screen's primary action. */
export function StaticPrimaryButton({
  label,
  loading = false,
  variant = 'primary',
  disabled,
  onPress,
  ...pressableProps
}: StaticPrimaryButtonProps) {
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
      onPress={(e) => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      }}
      {...pressableProps}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? theme.text.primary : theme.text.inverse} />
      ) : (
        <Text style={[styles.label, variant === 'outline' && styles.labelOutline]}>{label}</Text>
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
