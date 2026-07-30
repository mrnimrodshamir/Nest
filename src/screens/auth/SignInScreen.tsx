import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, AppleLogo } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { FormField } from '@/components/FormField';
import { StaticPrimaryButton } from '@/components/StaticPrimaryButton';
import { isValidEmail, isNonEmpty } from '@/utils/validation';
import { useAuth } from '@/hooks/useAuth';

interface SignInScreenProps {
  onBack: () => void;
  onForgotPassword: () => void;
  appleLoading?: boolean;
  onContinueWithApple?: () => void;
}

export function SignInScreen({
  onBack,
  onForgotPassword,
  appleLoading = false,
  onContinueWithApple,
}: SignInScreenProps) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const passwordRef = useRef<TextInput>(null);
  const inFlightRef = useRef(false);

  const handleSubmit = async () => {
    if (inFlightRef.current) return; // synchronous — checked before any state/render
    const errors: typeof fieldErrors = {};
    if (!isValidEmail(email)) errors.email = 'Enter a valid email address';
    if (!isNonEmpty(password)) errors.password = 'Enter your password';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    inFlightRef.current = true;
    setFormError(null);
    setIsSubmitting(true);
    try {
      const result = await signIn(email, password);
      if (result) setFormError(result); // form data (email/password) preserved on error
    } finally {
      setIsSubmitting(false);
      inFlightRef.current = false;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Pressable onPress={onBack} style={styles.backButton} accessibilityLabel="Back">
            <ArrowLeft size={20} color={theme.text.primary} />
          </Pressable>

          <Text style={styles.title}>Log in</Text>
          <Text style={styles.subtitle}>Welcome back to Momzi</Text>

          <View style={styles.form}>
            <FormField
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              autoComplete="email"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
              error={fieldErrors.email}
            />
            <FormField
              ref={passwordRef}
              label="Password"
              placeholder="Your password"
              value={password}
              onChangeText={setPassword}
              isPassword
              textContentType="password"
              autoComplete="password"
              returnKeyType="go"
              onSubmitEditing={handleSubmit}
              error={fieldErrors.password}
            />

            <Pressable onPress={onForgotPassword} style={styles.forgotLink} hitSlop={8}>
              <Text style={styles.forgotLinkLabel}>Forgot password?</Text>
            </Pressable>

            {formError && <Text style={styles.formError}>{formError}</Text>}

            <StaticPrimaryButton label="Log in" onPress={handleSubmit} loading={isSubmitting} />

            {onContinueWithApple && (
              <>
                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerLabel}>or</Text>
                  <View style={styles.dividerLine} />
                </View>

                <Pressable
                  style={[styles.appleButton, appleLoading && styles.appleButtonDisabled]}
                  onPress={onContinueWithApple}
                  disabled={appleLoading}
                  accessibilityLabel="Continue with Apple"
                  accessibilityRole="button"
                >
                  <AppleLogo size={18} color={theme.text.inverse} weight="fill" />
                  <Text style={styles.appleButtonLabel}>Continue with Apple</Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background.app },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: spacing['2xl'], paddingTop: spacing.md, paddingBottom: spacing['3xl'] },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.background.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: { ...typography.title1, color: theme.text.primary },
  subtitle: { ...typography.body, color: theme.text.secondary, marginBottom: spacing['2xl'] },
  form: { gap: spacing.lg },
  forgotLink: { alignSelf: 'flex-end', minHeight: 44, justifyContent: 'center' },
  forgotLinkLabel: { ...typography.footnote, color: theme.text.accent },
  formError: { ...typography.footnote, color: theme.semantic.danger, textAlign: 'center' },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, marginTop: spacing.xs },
  dividerLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: theme.border.default },
  dividerLabel: { ...typography.footnote, color: theme.text.muted },
  appleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: theme.text.primary,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    minHeight: 52,
  },
  appleButtonLabel: { ...typography.bodyMedium, color: theme.text.inverse },
  appleButtonDisabled: { opacity: 0.6 },
});
