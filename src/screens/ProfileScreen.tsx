import React, { useCallback, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { View, Text, Switch, StyleSheet, ScrollView, Alert, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import * as Application from 'expo-application';
import {
  CalendarBlank,
  PencilSimple,
  ProhibitInset,
  BellSimple,
  FileText,
  ShieldCheck,
  SignOut,
  Trash,
  CaretRight,
  EnvelopeSimple,
} from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { PersonCard } from '@/components/PersonCard';
import { useAuth } from '@/hooks/useAuth';
import { useChildren } from '@/hooks/useChildren';
import { formatParentSubtitle } from '@/utils/formatParentSubtitle';
import { ensurePushRegistration } from '@/hooks/usePushNotifications';
import { NotificationPermissionSheet } from '@/components/NotificationPermissionSheet';
import { LanguageSelector } from '@/components/LanguageSelector';
import { useI18n } from '@/i18n';
import { LEGAL_URLS } from '@/constants/legal';
import { SUPPORT_EMAIL, buildSupportMailtoUrl } from '@/utils/supportContact';
import type { NotificationPreferences } from '@/types/profile';
import { APP_NAME } from '@/constants/brand';
import { formatAppVersion } from '@/utils/appVersion';
import { safeCaregiverDisplayName } from '@/utils/profileIdentity';

interface ProfileScreenProps {
  onEditProfile: () => void;
  onOpenMyActivities: () => void;
  onOpenBlockedUsers: () => void;
}

const NOTIFICATION_LABEL_KEYS: Record<keyof NotificationPreferences, 'profile.notification.activityChanges' | 'profile.notification.chatMessages' | 'profile.notification.reminders' | 'profile.notification.dailyDigest' | 'profile.notification.weeklyDigest'> = {
  activity_changes: 'profile.notification.activityChanges',
  chat_messages: 'profile.notification.chatMessages',
  reminders: 'profile.notification.reminders',
  daily_digest: 'profile.notification.dailyDigest',
  weekly_digest: 'profile.notification.weeklyDigest',
};

/** The Profile tab -- the permanent home for every personal and account
 *  destination. A living identity page, not just a settings list. */
export function ProfileScreen({ onEditProfile, onOpenMyActivities, onOpenBlockedUsers }: ProfileScreenProps) {
  const { profile, session, signOut, deleteAccount, updateNotificationPreferences } = useAuth();
  const { children, refresh: refreshChildren } = useChildren(session?.user.id ?? null);

  // Children are edited on a different screen; without this the subtitle
  // kept rendering the list as it was when Profile first mounted, which is
  // why adding a second child still showed "Parent of Go".
  useFocusEffect(
    useCallback(() => {
      void refreshChildren();
    }, [refreshChildren]),
  );
  const [showNotificationSheet, setShowNotificationSheet] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const { t, isRTL, locale } = useI18n();

  const handleSignOut = () => {
    Alert.alert(t('profile.signOutConfirm'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('profile.signOut'), style: 'destructive', onPress: signOut },
    ]);
  };

  const handleContactSupport = async () => {
    const url = buildSupportMailtoUrl(locale);
    try {
      const canOpen = await Linking.canOpenURL(url);
      if (canOpen) {
        await Linking.openURL(url);
        return;
      }
    } catch {
      // Falls through to the same fallback as canOpen === false.
    }
    Alert.alert(t('profile.support.unavailable', { email: SUPPORT_EMAIL }));
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      t('profile.deleteConfirmTitle'),
      t('profile.deleteConfirmBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('profile.deleteAccount'),
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            const err = await deleteAccount();
            setIsDeleting(false);
            if (err) Alert.alert(t('profile.deleteError'), err);
          },
        },
      ],
    );
  };

  // Built from the FULL children list, never children[0] or the default
  // child — see utils/formatParentSubtitle.ts for the documented rule.
  const childSummary = formatParentSubtitle(children, profile?.parentRole ?? null, t);

  // Read from the installed binary, so this line identifies the build a tester
  // is actually running rather than what the repo says it should be.
  const versionLine = formatAppVersion(
    APP_NAME,
    Application.nativeApplicationVersion,
    Application.nativeBuildVersion,
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <PersonCard size="hero" name={safeCaregiverDisplayName(profile?.displayName)} avatarUrl={profile?.avatarUrl ?? null} subtitle={childSummary} />
        <Text style={styles.email}>{profile?.email}</Text>

        <Pressable style={styles.editLink} onPress={onEditProfile}>
          <PencilSimple size={14} color={theme.text.accent} />
          <Text style={styles.editLinkLabel}>{t('common.editProfile')}</Text>
        </Pressable>

        <MenuSection>
          <MenuRow icon={CalendarBlank} label={t('nav.myActivities')} onPress={onOpenMyActivities} />
          <MenuRow icon={PencilSimple} label={t('profile.editProfileAndChildren')} onPress={onEditProfile} isLast />
        </MenuSection>

        <View style={styles.sectionHeader}>
          <BellSimple size={16} color={theme.text.secondary} />
          <Text style={styles.sectionHeaderLabel}>{t('profile.notificationSettings')}</Text>
        </View>
        {profile && (
          <View style={styles.notificationCard}>
            {(Object.keys(NOTIFICATION_LABEL_KEYS) as Array<keyof NotificationPreferences>).map((key) => (
              <View key={key} style={styles.notificationRow}>
                <Text style={[styles.notificationLabel, isRTL && styles.rtlText]}>{t(NOTIFICATION_LABEL_KEYS[key])}</Text>
                <Switch
                  value={profile.notificationPreferences[key]}
                  onValueChange={async (value) => {
                    void updateNotificationPreferences({
                      ...profile.notificationPreferences,
                      [key]: value,
                    });
                    // Reminders and Daily Digest are the only toggles allowed
                    // to trigger the OS notification permission prompt (the
                    // other trigger entirely is joining a first activity) —
                    // never proactively, and always with the branded
                    // explainer first.
                    if ((key === 'reminders' || key === 'daily_digest' || key === 'weekly_digest') && value) {
                      const { status } = await Notifications.getPermissionsAsync();
                      if (status === 'undetermined') setShowNotificationSheet(true);
                      else void ensurePushRegistration(true);
                    }
                  }}
                  trackColor={{ true: theme.brand.primary, false: theme.border.default }}
                />
              </View>
            ))}
          </View>
        )}

        <LanguageSelector />

        <MenuSection>
          <MenuRow icon={ProhibitInset} label={t('profile.blockedMembers')} onPress={onOpenBlockedUsers} isLast />
        </MenuSection>

        <Pressable
          style={styles.supportCard}
          onPress={() => void handleContactSupport()}
          accessibilityRole="button"
          accessibilityLabel={t('profile.support.title')}
        >
          <EnvelopeSimple size={20} color={theme.brand.primary} />
          <View style={styles.supportTextColumn}>
            <Text style={[styles.supportTitle, isRTL && styles.rtlText]}>{t('profile.support.title')}</Text>
            <Text style={[styles.supportSubtitle, isRTL && styles.rtlText]}>{t('profile.support.subtitle')}</Text>
            {/* The address itself always stays LTR and legible, even inside
                an RTL layout — an email address read right-to-left is just
                broken, not merely stylistically off. */}
            <Text style={styles.supportEmail}>{SUPPORT_EMAIL}</Text>
          </View>
        </Pressable>

        <MenuSection>
          <MenuRow icon={FileText} label={t('profile.terms')} onPress={() => Linking.openURL(LEGAL_URLS.terms)} />
          <MenuRow icon={ShieldCheck} label={t('profile.privacy')} onPress={() => Linking.openURL(LEGAL_URLS.privacy)} isLast />
        </MenuSection>

        <Pressable style={styles.signOutButton} onPress={handleSignOut}>
          <SignOut size={18} color={theme.semantic.danger} />
          <Text style={styles.signOutLabel}>{t('profile.signOut')}</Text>
        </Pressable>

        <Pressable style={styles.deleteButton} onPress={handleDeleteAccount} disabled={isDeleting}>
          <Trash size={14} color={theme.text.muted} />
          <Text style={styles.deleteButtonLabel}>{isDeleting ? t('profile.deletingAccount') : t('profile.deleteAccount')}</Text>
        </Pressable>

        {/* Footer metadata: quiet, read-only, and selectable so a tester can
            copy it into a bug report. */}
        {versionLine && (
          <Text style={styles.versionLine} selectable>
            {versionLine}
          </Text>
        )}
      </ScrollView>

      <NotificationPermissionSheet
        visible={showNotificationSheet}
        onEnable={() => {
          setShowNotificationSheet(false);
          void ensurePushRegistration(true);
        }}
        onDismiss={() => setShowNotificationSheet(false)}
      />
    </SafeAreaView>
  );
}

function MenuSection({ children }: { children: React.ReactNode }) {
  return <View style={styles.menuSection}>{children}</View>;
}

function MenuRow({
  icon: Icon,
  label,
  onPress,
  isLast = false,
  disabled = false,
}: {
  icon: React.ComponentType<{ size: number; color: string }>;
  label: string;
  onPress: () => void;
  isLast?: boolean;
  disabled?: boolean;
}) {
  const { isRTL } = useI18n();
  return (
    <Pressable
      style={[styles.menuRow, !isLast && styles.menuRowDivider]}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Icon size={18} color={theme.text.secondary} />
      <Text style={styles.menuRowLabel}>{label}</Text>
      {!disabled && <CaretRight size={14} color={theme.text.muted} style={isRTL ? styles.flipped : undefined} />}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background.app },
  content: { alignItems: 'center', padding: spacing['2xl'], gap: spacing.sm },
  email: { ...typography.subhead, color: theme.text.secondary, marginTop: -spacing.xs },
  editLink: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.sm },
  editLinkLabel: { ...typography.footnote, color: theme.text.accent, fontWeight: '600' as const },
  menuSection: {
    width: '100%',
    backgroundColor: theme.background.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border.default,
    overflow: 'hidden',
  },
  supportCard: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    backgroundColor: theme.background.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border.default,
    padding: spacing.lg,
  },
  supportTextColumn: { flex: 1, gap: 2 },
  supportTitle: { ...typography.bodyMedium, color: theme.text.primary },
  supportSubtitle: { ...typography.footnote, color: theme.text.secondary },
  // Always LTR regardless of interface direction — see the render-site comment.
  supportEmail: { ...typography.footnote, color: theme.text.accent, textAlign: 'left', writingDirection: 'ltr', marginTop: 2 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
  },
  menuRowDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: theme.border.default },
  menuRowLabel: { ...typography.bodyMedium, color: theme.text.primary, flex: 1 },
  sectionHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xs,
    marginTop: spacing.sm,
  },
  sectionHeaderLabel: { ...typography.footnote, fontWeight: '600' as const, color: theme.text.secondary },
  notificationCard: {
    width: '100%',
    backgroundColor: theme.background.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border.default,
    gap: spacing.sm,
  },
  notificationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  notificationLabel: { ...typography.subhead, color: theme.text.secondary },
  rtlText: { textAlign: 'right', writingDirection: 'rtl' },
  flipped: { transform: [{ scaleX: -1 }] },
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingHorizontal: spacing.lg,
    minHeight: 44,
  },
  signOutLabel: { ...typography.bodyMedium, color: theme.semantic.danger },
  deleteButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 44 },
  deleteButtonLabel: { ...typography.caption, color: theme.text.muted },
  // Deliberately the quietest text on the screen: diagnostic, not a feature.
  versionLine: {
    ...typography.caption,
    color: theme.text.muted,
    textAlign: 'center',
    marginTop: spacing.md,
  },
});
