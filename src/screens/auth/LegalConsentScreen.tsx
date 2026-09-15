import React, { useState } from 'react';
import { ActivityIndicator, Linking, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { Checkbox } from '@/components/Checkbox';
import { PrimaryButton } from '@/components/PrimaryButton';
import { APP_NAME } from '@/constants/brand';
import { LEGAL_URLS } from '@/constants/legal';
import { useAuth } from '@/hooks/useAuth';
import { useI18n } from '@/i18n';
import { spacing, theme, typography } from '@/theme';

interface LegalConsentScreenProps {
  /** Pre-auth acknowledgement only; authenticated consent is still saved by the root gate. */
  onContinueBeforeAuth?: () => void;
}

export function LegalConsentScreen({ onContinueBeforeAuth }: LegalConsentScreenProps = {}) {
  const { acceptLegalTerms, signOut } = useAuth();
  const { t, isRTL } = useI18n();
  const [checked, setChecked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    if (!checked || saving) return;
    if (onContinueBeforeAuth) {
      onContinueBeforeAuth();
      return;
    }
    setSaving(true);
    setError(null);
    setError(await acceptLegalTerms());
    setSaving(false);
  };

  return <SafeAreaView style={styles.container}>
    <View style={styles.content}>
      <Text style={[styles.title, isRTL && styles.rtl]}>{t('legal.title', { appName: APP_NAME })}</Text>
      <Text style={[styles.body, isRTL && styles.rtl]}>{t('legal.body')}</Text>
      <Checkbox checked={checked} onToggle={() => setChecked((value) => !value)}>
        {t('legal.agreePrefix')}{' '}
        <Text style={styles.link} onPress={() => void Linking.openURL(LEGAL_URLS.terms)}>{t('profile.terms')}</Text>
        {' '}{t('onboarding.and')}{' '}
        <Text style={styles.link} onPress={() => void Linking.openURL(LEGAL_URLS.privacy)}>{t('profile.privacy')}</Text>
      </Checkbox>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <PrimaryButton label={t('legal.accept')} onPress={() => void accept()} disabled={!checked || saving} />
      {saving ? <ActivityIndicator color={theme.brand.primary} /> : null}
      {!onContinueBeforeAuth && <Pressable onPress={() => void signOut()} accessibilityRole="button"><Text style={styles.signOut}>{t('profile.signOut')}</Text></Pressable>}
    </View>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background.app },
  content: { flex: 1, justifyContent: 'center', padding: spacing['2xl'], gap: spacing.lg },
  title: { ...typography.title1, color: theme.text.primary, textAlign: 'left' },
  body: { ...typography.body, color: theme.text.secondary, textAlign: 'left' },
  rtl: { textAlign: 'right', writingDirection: 'rtl' },
  link: { color: theme.text.accent, textDecorationLine: 'underline' },
  error: { ...typography.footnote, color: theme.semantic.danger, textAlign: 'center' },
  signOut: { ...typography.footnote, color: theme.text.secondary, textAlign: 'center', padding: spacing.md },
});
