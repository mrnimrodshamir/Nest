import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'phosphor-react-native';
import { theme, typography, spacing } from '@/theme';
import { FormField } from '@/components/FormField';
import { PrimaryButton } from '@/components/PrimaryButton';
import { isValidEmail } from '@/utils/validation';
import { useAuth } from '@/hooks/useAuth';

interface ForgotPasswordScreenProps {
  onBack: () => void;
}

export function ForgotPasswordScreen({ onBack }: ForgotPasswordScreenProps) {
  const { resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async () => {
    if (!isValidEmail(email)) {
      setError('Enter a valid email address');
      return;
    }
    setError(null);
    setIsSubmitting(true);
    const result = await resetPassword(email.trim());
    setIsSubmitting(false);
    if (result) setError(result);
    else setSent(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Pressable onPress={onBack} style={styles.backButton} accessibilityLabel="Back">
          <ArrowLeft size={20} color={theme.text.primary} />
        </Pressable>

        <Text style={styles.title}>Reset password</Text>

        {sent ? (
          <Text style={styles.subtitle}>
            If an account exists for {email.trim()}, we've sent a password reset link.
          </Text>
        ) : (
          <>
            <Text style={styles.subtitle}>
              Enter your email and we'll send you a link to reset your password.
            </Text>
            <View style={styles.form}>
              <FormField
                label="Email"
                placeholder="you@example.com"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                error={error}
              />
              <PrimaryButton label="Send reset link" onPress={handleSubmit} loading={isSubmitting} />
            </View>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background.app },
  content: { flex: 1, paddingHorizontal: spacing['2xl'], paddingTop: spacing.md },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.background.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  title: { ...typography.title1, color: theme.text.primary, marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: theme.text.secondary, marginBottom: spacing['2xl'] },
  form: { gap: spacing.lg },
});
