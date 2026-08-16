import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppleLogo } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { NestUpLogo } from '@/components/NestUpLogo';
import { StaticPrimaryButton } from '@/components/StaticPrimaryButton';
import { APP_NAME } from '@/constants/brand';
import { useI18n } from '@/i18n';

interface WelcomeScreenProps {
  onContinueWithApple: () => void;
  onSignUpWithEmail: () => void;
  onLogIn: () => void;
  appleLoading?: boolean;
}

export function WelcomeScreen({
  onContinueWithApple,
  onSignUpWithEmail,
  onLogIn,
  appleLoading = false,
}: WelcomeScreenProps) {
  const { t, isRTL } = useI18n();
  return (
    <View style={styles.container}>
      <View style={styles.blobTop} />
      <View style={styles.blobMid} />
      <View style={styles.blobBottom} />

      <SafeAreaView style={styles.content} edges={['top', 'bottom']}>
        <View style={[styles.hero, isRTL && styles.heroRtl]}>
          <NestUpLogo size={128} />
          <Text style={styles.wordmark}>{APP_NAME}</Text>
          <Text style={[styles.tagline, isRTL && styles.rtlText]}>{t('auth.tagline')}</Text>
          <Text style={[styles.subtagline, isRTL && styles.rtlText]}>{t('auth.subtitle')}</Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={[styles.appleButton, appleLoading && styles.buttonDisabled]}
            onPress={onContinueWithApple}
            disabled={appleLoading}
            accessibilityLabel={t('auth.continueApple')}
            accessibilityRole="button"
          >
            <AppleLogo size={18} color={theme.text.inverse} weight="fill" />
            <Text style={styles.appleButtonLabel}>{t('auth.continueApple')}</Text>
          </Pressable>

          <StaticPrimaryButton label={t('auth.signUpEmail')} onPress={onSignUpWithEmail} />

          <Pressable style={styles.loginLink} onPress={onLogIn} hitSlop={8}>
            <Text style={styles.loginLinkLabel}>
              {t('auth.alreadyHere', { appName: APP_NAME })} <Text style={styles.loginLinkAccent}>{t('auth.logIn')}</Text>
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background.app, overflow: 'hidden' },
  blobTop: {
    position: 'absolute',
    top: -120,
    right: -80,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: theme.brand.roseBlush,
    opacity: 0.55,
  },
  blobMid: {
    position: 'absolute',
    top: 260,
    left: -110,
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: theme.brand.primaryTint,
    opacity: 0.5,
  },
  blobBottom: {
    position: 'absolute',
    bottom: -140,
    left: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: theme.background.surfaceAlt,
  },
  content: { flex: 1, justifyContent: 'space-between', paddingHorizontal: spacing['2xl'] },
  hero: { flex: 1, justifyContent: 'center', alignItems: 'flex-start' },
  heroRtl: { alignItems: 'flex-end' },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  wordmark: {
    ...typography.display,
    fontSize: 44,
    color: theme.text.accent,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  tagline: { ...typography.title2, color: theme.text.primary, marginBottom: spacing.sm },
  subtagline: { ...typography.body, color: theme.text.secondary, lineHeight: 24 },
  actions: { gap: spacing.md, paddingBottom: spacing.xl },
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
  buttonDisabled: { opacity: 0.6 },
  loginLink: { alignItems: 'center', paddingTop: spacing.sm, minHeight: 44, justifyContent: 'center' },
  loginLinkLabel: { ...typography.subhead, color: theme.text.secondary },
  loginLinkAccent: { color: theme.text.accent, fontFamily: typography.bodyMedium.fontFamily },
});
