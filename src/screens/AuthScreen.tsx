import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme, typography, spacing, radius } from '@/theme';
import { useAuth } from '@/hooks/useAuth';

export function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signIn' | 'signUp'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);

    const result =
      mode === 'signIn'
        ? await signIn(email.trim(), password)
        : await signUp(email.trim(), password, displayName.trim() || email.split('@')[0]);

    setIsSubmitting(false);
    if (result) setError(result);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Text style={styles.title}>Monzy</Text>
          <Text style={styles.subtitle}>
            {mode === 'signIn' ? 'Welcome back' : 'Meet moms nearby'}
          </Text>

          {mode === 'signUp' && (
            <TextInput
              style={styles.input}
              placeholder="Your name"
              placeholderTextColor={theme.text.muted}
              value={displayName}
              onChangeText={setDisplayName}
              autoCapitalize="words"
            />
          )}

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor={theme.text.muted}
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
          />

          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor={theme.text.muted}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          {error && <Text style={styles.error}>{error}</Text>}

          <Pressable
            style={[styles.button, isSubmitting && styles.buttonDisabled]}
            onPress={handleSubmit}
            disabled={isSubmitting}
          >
            <Text style={styles.buttonLabel}>
              {isSubmitting ? 'Please wait…' : mode === 'signIn' ? 'Sign in' : 'Create account'}
            </Text>
          </Pressable>

          <Pressable
            style={styles.switchModeButton}
            onPress={() => {
              setError(null);
              setMode(mode === 'signIn' ? 'signUp' : 'signIn');
            }}
          >
            <Text style={styles.switchModeLabel}>
              {mode === 'signIn' ? "New here? Create an account" : 'Already have an account? Sign in'}
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background.app },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing['2xl'],
    gap: spacing.md,
  },
  title: { ...typography.display, color: theme.text.accent, textAlign: 'center' },
  subtitle: {
    ...typography.body,
    color: theme.text.secondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
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
  error: { ...typography.footnote, color: theme.semantic.danger, textAlign: 'center' },
  button: {
    backgroundColor: theme.brand.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonLabel: { ...typography.bodyMedium, color: theme.text.inverse },
  switchModeButton: { alignItems: 'center', marginTop: spacing.lg },
  switchModeLabel: { ...typography.footnote, color: theme.text.accent },
});
