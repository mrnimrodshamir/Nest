import React, { forwardRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, TextInputProps } from 'react-native';
import { Eye, EyeSlash } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';

interface FormFieldProps extends TextInputProps {
  label: string;
  error?: string | null;
  /** Renders a show/hide toggle and manages secureTextEntry internally —
   *  don't also pass secureTextEntry when using this. */
  isPassword?: boolean;
}

export const FormField = forwardRef<TextInput, FormFieldProps>(function FormField(
  { label, error, style, isPassword, ...inputProps },
  ref,
) {
  const [revealed, setRevealed] = useState(false);

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputRow}>
        <TextInput
          ref={ref}
          style={[
            styles.input,
            isPassword ? styles.inputWithAdornment : null,
            error ? styles.inputError : null,
            style,
          ]}
          placeholderTextColor={theme.text.muted}
          secureTextEntry={isPassword ? !revealed : inputProps.secureTextEntry}
          {...inputProps}
        />
        {isPassword && (
          <Pressable
            onPress={() => setRevealed((v) => !v)}
            style={styles.adornment}
            hitSlop={8}
            accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
            accessibilityRole="button"
          >
            {revealed ? (
              <EyeSlash size={20} color={theme.text.muted} />
            ) : (
              <Eye size={20} color={theme.text.muted} />
            )}
          </Pressable>
        )}
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
});

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  label: { ...typography.footnote, color: theme.text.secondary },
  inputRow: { position: 'relative', justifyContent: 'center' },
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
  inputWithAdornment: { paddingRight: spacing['4xl'] },
  adornment: {
    position: 'absolute',
    right: spacing.md,
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inputError: { borderColor: theme.semantic.danger },
  error: { ...typography.caption, color: theme.semantic.danger },
});
