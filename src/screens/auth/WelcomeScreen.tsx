import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppleLogo } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { MomziLogo } from '@/components/MomziLogo';

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
  return (
    <View style={styles.container}>
      <View style={styles.blobTop} />
      <View style={styles.blobBottom} />

      <SafeAreaView style={styles.content} edges={['top', 'bottom']}>
        <View style={styles.hero}>
          <MomziLogo size={72} />
          <Text style={styles.wordmark}>Momzi</Text>
          <Text style={styles.tagline}>
            Meet mothers nearby.{'\n'}Real friendships, one walk at a time.
          </Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            style={[styles.appleButton, appleLoading && styles.buttonDisabled]}
            onPress={onContinueWithApple}
            disabled={appleLoading}
            accessibilityLabel="Continue with Apple"
          >
            <AppleLogo size={18} color={theme.text.inverse} weight="fill" />
            <Text style={styles.appleButtonLabel}>Continue with Apple</Text>
          </Pressable>

          <Pressable style={styles.emailButton} onPress={onSignUpWithEmail}>
            <Text style={styles.emailButtonLabel}>Sign up with email</Text>
          </Pressable>

          <Pressable style={styles.loginLink} onPress={onLogIn}>
            <Text style={styles.loginLinkLabel}>
              Already on Momzi? <Text style={styles.loginLinkAccent}>Log in</Text>
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
    backgroundColor: theme.brand.primaryTint,
  },
  blobBottom: {
    position: 'absolute',
    bottom: -140,
    left: -100,
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: theme.brand.secondaryTint,
  },
  content: { flex: 1, justifyContent: 'space-between', paddingHorizontal: spacing['2xl'] },
  hero: { flex: 1, justifyContent: 'center' },
  wordmark: {
    ...typography.display,
    fontSize: 44,
    color: theme.text.accent,
    marginTop: spacing.lg,
    marginBottom: spacing.md,
  },
  tagline: { ...typography.title3, color: theme.text.secondary, lineHeight: 28 },
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
  emailButton: {
    backgroundColor: theme.background.surface,
    borderWidth: 1,
    borderColor: theme.border.strong,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  emailButtonLabel: { ...typography.bodyMedium, color: theme.text.primary },
  loginLink: { alignItems: 'center', paddingTop: spacing.sm },
  loginLinkLabel: { ...typography.subhead, color: theme.text.secondary },
  loginLinkAccent: { color: theme.text.accent, fontFamily: typography.bodyMedium.fontFamily },
});
