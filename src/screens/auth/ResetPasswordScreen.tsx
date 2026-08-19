import React, { useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FormField } from '@/components/FormField';
import { StaticPrimaryButton } from '@/components/StaticPrimaryButton';
import { theme, typography, spacing } from '@/theme';
import { isValidPassword } from '@/utils/validation';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n';

/** Shown while a tapped recovery-email link's temporary session is active
 *  (`useAuth().isPasswordRecovery`). Two distinct outcomes:
 *
 *  - `linkStatus === 'ok'`: a real recovery session exists — show the
 *    new-password form.
 *  - `linkStatus === 'expired' | 'malformed'`: the link itself was rejected
 *    (used, expired, tampered with) before any session was ever
 *    established, so there is nothing to reset yet — offer a way back to
 *    request a fresh link instead of showing a form that can't work. */
export function ResetPasswordScreen({
  linkStatus,
  onRequestNewLink,
}: {
  linkStatus: 'ok' | 'expired' | 'malformed';
  onRequestNewLink: () => void;
}) {
  const { completePasswordRecovery, cancelPasswordRecovery } = useAuth();
  const { t, isRTL } = useI18n();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const inFlightRef = useRef(false);

  const handleSubmit = async () => {
    if (inFlightRef.current) return;
    if (!isValidPassword(password)) {
      setError(t('onboarding.passwordInvalid'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.reset.mismatch'));
      return;
    }
    inFlightRef.current = true;
    setError(null);
    setIsSubmitting(true);
    const result = await completePasswordRecovery(password);
    setIsSubmitting(false);
    inFlightRef.current = false;
    if (result) setError(result);
    else setDone(true);
  };

  if (linkStatus !== 'ok') {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <Text style={[styles.title, isRTL && styles.rtlText]}>{t('auth.reset.linkInvalidTitle')}</Text>
          <Text style={[styles.subtitle, isRTL && styles.rtlText]}>
            {linkStatus === 'expired' ? t('auth.reset.linkExpired') : t('auth.reset.linkMalformed')}
          </Text>
          <StaticPrimaryButton label={t('auth.reset.requestNewLink')} onPress={onRequestNewLink} />
        </View>
      </SafeAreaView>
    );
  }

  if (done) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.content}>
          <Text style={[styles.title, isRTL && styles.rtlText]}>{t('auth.reset.doneTitle')}</Text>
          <Text style={[styles.subtitle, isRTL && styles.rtlText]}>{t('auth.reset.doneBody')}</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.content}>
        <Text style={[styles.title, isRTL && styles.rtlText]}>{t('auth.reset.title')}</Text>
        <Text style={[styles.subtitle, isRTL && styles.rtlText]}>{t('auth.reset.instructions')}</Text>
        <View style={styles.form}>
          <FormField
            label={t('onboarding.password')}
            placeholder={t('auth.passwordPlaceholder')}
            value={password}
            onChangeText={setPassword}
            isPassword
            autoCapitalize="none"
            autoCorrect={false}
            forceLTR
          />
          <FormField
            label={t('auth.reset.confirmPassword')}
            placeholder={t('auth.passwordPlaceholder')}
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            isPassword
            autoCapitalize="none"
            autoCorrect={false}
            error={error}
            forceLTR
          />
          <StaticPrimaryButton label={t('auth.reset.submit')} onPress={handleSubmit} loading={isSubmitting} />
          <Pressable onPress={() => void cancelPasswordRecovery()} accessibilityRole="button">
            <Text style={[styles.cancel, isRTL && styles.rtlText]}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background.app },
  content: { flex: 1, paddingHorizontal: spacing['2xl'], paddingTop: spacing.xl },
  title: { ...typography.title1, color: theme.text.primary, marginBottom: spacing.sm },
  subtitle: { ...typography.body, color: theme.text.secondary, marginBottom: spacing['2xl'] },
  form: { gap: spacing.lg },
  cancel: { ...typography.footnote, color: theme.text.muted, textAlign: 'center', marginTop: spacing.sm },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
});
