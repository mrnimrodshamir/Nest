import React, { useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft } from 'phosphor-react-native';
import { theme, typography, spacing } from '@/theme';
import { FormField } from '@/components/FormField';
import { StaticPrimaryButton } from '@/components/StaticPrimaryButton';
import { isValidEmail } from '@/utils/validation';
import { useAuth } from '@/hooks/useAuth';
import { isolateText, useI18n } from '@/i18n';

interface ForgotPasswordScreenProps {
  onBack: () => void;
}

export function ForgotPasswordScreen({ onBack }: ForgotPasswordScreenProps) {
  const { resetPassword } = useAuth();
  const { t, isRTL } = useI18n();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  // Synchronous guard alongside isSubmitting (state) — a fast double-tap
  // can fire two onPress handlers before the disabled-button re-render
  // commits, same pattern used across the app's other submit buttons.
  const inFlightRef = useRef(false);

  const handleSubmit = async () => {
    if (inFlightRef.current) return;
    if (!isValidEmail(email)) {
      setError(t('onboarding.emailInvalid'));
      return;
    }
    inFlightRef.current = true;
    setError(null);
    setIsSubmitting(true);
    const result = await resetPassword(email.trim());
    setIsSubmitting(false);
    inFlightRef.current = false;
    if (result) setError(result);
    else setSent(true);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Pressable onPress={onBack} style={styles.backButton} accessibilityLabel={t('common.back')}>
          <ArrowLeft size={20} color={theme.text.primary} style={isRTL ? styles.flipped : undefined} />
        </Pressable>

        <Text style={[styles.title, isRTL && styles.rtlText]}>{t('auth.resetTitle')}</Text>

        {sent ? (
          <Text style={[styles.subtitle, isRTL && styles.rtlText]}>{t('auth.resetSent', { email: isolateText(email.trim()) })}</Text>
        ) : (
          <>
            <Text style={[styles.subtitle, isRTL && styles.rtlText]}>{t('auth.resetInstructions')}</Text>
            <View style={styles.form}>
              <FormField
                label={t('onboarding.email')}
            placeholder={t('onboarding.emailPlaceholder')}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                error={error}
                forceLTR
              />
              <StaticPrimaryButton label={t('auth.sendReset')} onPress={handleSubmit} loading={isSubmitting} />
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
  flipped: { transform: [{ scaleX: -1 }] },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
});
