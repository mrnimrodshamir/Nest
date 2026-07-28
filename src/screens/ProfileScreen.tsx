import React, { useState } from 'react';
import { View, Text, Switch, StyleSheet, ScrollView, Alert, Pressable, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import {
  CalendarBlank,
  PencilSimple,
  Baby,
  ProhibitInset,
  BellSimple,
  FileText,
  ShieldCheck,
  SignOut,
  Trash,
  CaretRight,
} from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { PersonCard } from '@/components/PersonCard';
import { useAuth } from '@/hooks/useAuth';
import { useChildren } from '@/hooks/useChildren';
import { ensurePushRegistration } from '@/hooks/usePushNotifications';
import { NotificationPermissionSheet } from '@/components/NotificationPermissionSheet';
import { LEGAL_URLS } from '@/constants/legal';
import type { NotificationPreferences } from '@/types/profile';

interface ProfileScreenProps {
  onEditProfile: () => void;
  onOpenMyActivities: () => void;
  onOpenBlockedUsers: () => void;
}

const NOTIFICATION_LABELS: Record<keyof NotificationPreferences, string> = {
  activity_changes: 'Activity updates',
  chat_messages: 'New messages',
  reminders: 'Reminders before activities',
};

/** The Profile tab -- the permanent home for every personal and account
 *  destination. A living identity page, not just a settings list. */
export function ProfileScreen({ onEditProfile, onOpenMyActivities, onOpenBlockedUsers }: ProfileScreenProps) {
  const { profile, session, signOut, deleteAccount, updateNotificationPreferences } = useAuth();
  const { children } = useChildren(session?.user.id ?? null);
  const [showNotificationSheet, setShowNotificationSheet] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleSignOut = () => {
    Alert.alert('Sign out?', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: signOut },
    ]);
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete your account?',
      'This permanently removes your profile, children, activities, and messages. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete account',
          style: 'destructive',
          onPress: async () => {
            setIsDeleting(true);
            const err = await deleteAccount();
            setIsDeleting(false);
            if (err) Alert.alert("Couldn't delete your account", err);
          },
        },
      ],
    );
  };

  const childSummary =
    children.length === 0
      ? undefined
      : children.length === 1
        ? `Mom of ${children[0].name}`
        : `Mom of ${children.length} children`;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.content}>
        <PersonCard size="hero" name={profile?.displayName ?? 'Momzi member'} avatarUrl={profile?.avatarUrl ?? null} subtitle={childSummary} />
        <Text style={styles.email}>{profile?.email}</Text>

        <Pressable style={styles.editLink} onPress={onEditProfile}>
          <PencilSimple size={14} color={theme.text.accent} />
          <Text style={styles.editLinkLabel}>Edit profile</Text>
        </Pressable>

        <MenuSection>
          <MenuRow icon={CalendarBlank} label="My Activities" onPress={onOpenMyActivities} />
          <MenuRow icon={PencilSimple} label="Edit Profile" onPress={onEditProfile} />
          <MenuRow icon={Baby} label="Children" onPress={onEditProfile} isLast />
        </MenuSection>

        <View style={styles.sectionHeader}>
          <BellSimple size={16} color={theme.text.secondary} />
          <Text style={styles.sectionHeaderLabel}>Notification settings</Text>
        </View>
        {profile && (
          <View style={styles.notificationCard}>
            {(Object.keys(NOTIFICATION_LABELS) as Array<keyof NotificationPreferences>).map((key) => (
              <View key={key} style={styles.notificationRow}>
                <Text style={styles.notificationLabel}>{NOTIFICATION_LABELS[key]}</Text>
                <Switch
                  value={profile.notificationPreferences[key]}
                  onValueChange={async (value) => {
                    void updateNotificationPreferences({
                      ...profile.notificationPreferences,
                      [key]: value,
                    });
                    // Reminders is one of only two moments allowed to trigger
                    // the OS notification permission prompt (the other is
                    // joining a first activity) — never proactively, and
                    // always with the branded explainer first.
                    if (key === 'reminders' && value) {
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

        <MenuSection>
          <MenuRow icon={ProhibitInset} label="Blocked members" onPress={onOpenBlockedUsers} isLast />
        </MenuSection>

        <MenuSection>
          <MenuRow icon={FileText} label="Terms of Service" onPress={() => Linking.openURL(LEGAL_URLS.terms)} />
          <MenuRow icon={ShieldCheck} label="Privacy Policy" onPress={() => Linking.openURL(LEGAL_URLS.privacy)} isLast />
        </MenuSection>

        <Pressable style={styles.signOutButton} onPress={handleSignOut}>
          <SignOut size={18} color={theme.semantic.danger} />
          <Text style={styles.signOutLabel}>Sign out</Text>
        </Pressable>

        <Pressable style={styles.deleteButton} onPress={handleDeleteAccount} disabled={isDeleting}>
          <Trash size={14} color={theme.text.muted} />
          <Text style={styles.deleteButtonLabel}>{isDeleting ? 'Deleting…' : 'Delete account'}</Text>
        </Pressable>
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
      {!disabled && <CaretRight size={14} color={theme.text.muted} />}
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
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  signOutLabel: { ...typography.bodyMedium, color: theme.semantic.danger },
  deleteButton: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingVertical: spacing.sm },
  deleteButtonLabel: { ...typography.caption, color: theme.text.muted },
});
