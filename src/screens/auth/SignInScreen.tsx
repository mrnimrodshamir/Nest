import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'phosphor-react-native';
import { theme, typography, spacing } from '@/theme';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { isValidEmail, isNonEmpty } from '@/utils/validation';
import { useAuth } from '@/hooks/useAuth';

interface SignInScreenProps {
  onBack: () => void;
  onForgotPassword: () => void;
}

export function SignInScreen({ onBack, onForgotPassword }: SignInScreenProps) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    const errors: typeof fieldErrors = {};
    if (!isValidEmail(email)) errors.email = 'Enter a valid email address';
    if (!isNonEmpty(password)) errors.password = 'Enter your password';
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setFormError(null);
    setIsSubmitting(true);
    const result = await signIn(email.trim(), password);
    setIsSubmitting(false);
    if (result) setFormError(result);
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
              error={fieldErrors.email}
            />
            <FormField
              label="Password"
              placeholder="Your password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              error={fieldErrors.password}
            />

            <Pressable onPress={onForgotPassword} style={styles.forgotLink}>
              <Text style={styles.forgotLinkLabel}>Forgot password?</Text>
            </Pressable>

            {formError && <Text style={styles.formError}>{formError}</Text>}

            <PrimaryButton label="Log in" onPress={handleSubmit} loading={isSubmitting} />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background.app },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: spacing['2xl'], paddingTop: spacing.md },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.background.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: { ...typography.title1, color: theme.text.primary },
  subtitle: { ...typography.body, color: theme.text.secondary, marginBottom: spacing['2xl'] },
  form: { gap: spacing.lg },
  forgotLink: { alignSelf: 'flex-end' },
  forgotLinkLabel: { ...typography.footnote, color: theme.text.accent },
  formError: { ...typography.footnote, color: theme.semantic.danger, textAlign: 'center' },
});
