import React from 'react';
import { Pressable, Text, StyleSheet, ActivityIndicator, PressableProps } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, useReducedMotion } from 'react-native-reanimated';
import { theme, typography, spacing, radius, pressFeedback } from '@/theme';

interface PrimaryButtonProps extends Omit<PressableProps, 'style'> {
  label: string;
  loading?: boolean;
  variant?: 'primary' | 'secondary' | 'outline';
}

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export function PrimaryButton({
  label,
  loading = false,
  variant = 'primary',
  disabled,
  onPressIn,
  onPressOut,
  ...pressableProps
}: PrimaryButtonProps) {
  const isDisabled = disabled || loading;
  const reducedMotion = useReducedMotion();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedPressable
      style={[
        styles.button,
        variant === 'secondary' && styles.buttonSecondary,
        variant === 'outline' && styles.buttonOutline,
        isDisabled && styles.buttonDisabled,
        animatedStyle,
      ]}
      disabled={isDisabled}
      onPressIn={(e) => {
        if (!reducedMotion) scale.value = withSpring(pressFeedback.scale, pressFeedback.spring);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        if (!reducedMotion) scale.value = withSpring(1, pressFeedback.spring);
        onPressOut?.(e);
      }}
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
    </AnimatedPressable>
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
