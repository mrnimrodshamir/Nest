import React, { useState } from 'react';
import { View, Text, Image, Pressable, Switch, StyleSheet, ScrollView, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Notifications from 'expo-notifications';
import { ArrowLeft, SignOut, PencilSimple, CalendarBlank, ChatCircleDots, Trash, ProhibitInset } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { useAuth } from '@/hooks/useAuth';
import { useChildren } from '@/hooks/useChildren';
import { ensurePushRegistration } from '@/hooks/usePushNotifications';
import { NotificationPermissionSheet } from '@/components/NotificationPermissionSheet';
import { LEGAL_URLS } from '@/constants/legal';
import { formatBabyAge, birthdateToMonths } from '@/utils/babyAge';
import type { NotificationPreferences } from '@/types/profile';

interface ProfileScreenProps {
  onBack: () => void;
  onEditProfile: () => void;
  onOpenMyActivities: () => void;
  onOpenMessages: () => void;
  onOpenBlockedUsers: () => void;
}

const NOTIFICATION_LABELS: Record<keyof NotificationPreferences, string> = {
  activity_changes: 'Activity updates',
  chat_messages: 'New messages',
  reminders: 'Reminders before activities',
};

export function ProfileScreen({
  onBack,
  onEditProfile,
  onOpenMyActivities,
  onOpenMessages,
  onOpenBlockedUsers,
}: ProfileScreenProps) {
  const { profile, session, signOut, deleteAccount, updateNotificationPreferences } = useAuth();
  const { children } = useChildren(session?.user.id ?? null);
  const [showNotificationSheet, setShowNotificationSheet] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const defaultChild = children.find((c) => c.isDefault) ?? children[0] ?? null;

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

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Pressable onPress={onBack} style={styles.backButton} accessibilityLabel="Back">
        <ArrowLeft size={20} color={theme.text.primary} />
      </Pressable>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.avatarWrap}>
          {profile?.avatarUrl ? (
            <Image source={{ uri: profile.avatarUrl }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarPlaceholder}>
              <Text style={styles.avatarInitial}>{profile?.displayName?.[0]?.toUpperCase() ?? '?'}</Text>
            </View>
          )}
        </View>

        <Text style={styles.name}>{profile?.displayName ?? 'Momzi member'}</Text>
        <Text style={styles.email}>{profile?.email}</Text>

        <Pressable style={styles.editButton} onPress={onEditProfile}>
          <PencilSimple size={14} color={theme.text.accent} />
          <Text style={styles.editButtonLabel}>Edit profile</Text>
        </Pressable>

        {children.length > 0 && (
          <View style={styles.babyCard}>
            <Text style={styles.babyCardLabel}>{children.length > 1 ? 'Children' : 'Child'}</Text>
            {children.map((child) => (
              <Text key={child.id} style={styles.babyCardValue}>
                {child.name}
                {child.birthdate ? ` · ${formatBabyAge(birthdateToMonths(child.birthdate))}` : ''}
                {children.length > 1 && child.id === defaultChild?.id ? ' (default)' : ''}
              </Text>
            ))}
          </View>
        )}

        <View style={styles.actionsRow}>
          <Pressable style={styles.actionButton} onPress={onOpenMyActivities}>
            <CalendarBlank size={20} color={theme.text.accent} />
            <Text style={styles.actionButtonLabel}>My Activities</Text>
          </Pressable>
          <Pressable style={styles.actionButton} onPress={onOpenMessages}>
            <ChatCircleDots size={20} color={theme.text.accent} />
            <Text style={styles.actionButtonLabel}>Messages</Text>
          </Pressable>
        </View>

        <View style={styles.infoCard}>
          <InfoRow label="Phone" value={profile?.phone ?? '—'} />
          <Text style={styles.privacyNote}>Your phone number is private and never shown to other members.</Text>
        </View>

        {profile && (
          <View style={styles.infoCard}>
            <Text style={styles.babyCardLabel}>Notifications</Text>
            {(Object.keys(NOTIFICATION_LABELS) as Array<keyof NotificationPreferences>).map((key) => (
              <View key={key} style={styles.infoRow}>
                <Text style={styles.infoLabel}>{NOTIFICATION_LABELS[key]}</Text>
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

        <Pressable style={styles.blockedRow} onPress={onOpenBlockedUsers}>
          <ProhibitInset size={16} color={theme.text.secondary} />
          <Text style={styles.blockedRowLabel}>Blocked members</Text>
        </Pressable>

        <View style={styles.legalRow}>
          <Pressable onPress={() => Linking.openURL(LEGAL_URLS.terms)}>
            <Text style={styles.legalLink}>Terms of Service</Text>
          </Pressable>
          <Text style={styles.legalDivider}>·</Text>
          <Pressable onPress={() => Linking.openURL(LEGAL_URLS.privacy)}>
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </Pressable>
        </View>

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

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background.app },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: theme.background.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.lg,
    marginTop: spacing.sm,
  },
  content: { alignItems: 'center', padding: spacing['2xl'], gap: spacing.md },
  avatarWrap: { marginBottom: spacing.sm },
  avatar: { width: 96, height: 96, borderRadius: radius.pill },
  avatarPlaceholder: {
    width: 96,
    height: 96,
    borderRadius: radius.pill,
    backgroundColor: theme.brand.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInitial: { ...typography.display, fontSize: 32, color: theme.text.accent },
  name: { ...typography.title2, color: theme.text.primary },
  email: { ...typography.subhead, color: theme.text.secondary },
  editButton: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: spacing.md },
  editButtonLabel: { ...typography.footnote, color: theme.text.accent, fontWeight: '600' as const },
  babyCard: {
    width: '100%',
    backgroundColor: theme.background.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border.default,
    gap: 4,
  },
  babyCardLabel: { ...typography.caption, color: theme.text.muted, marginBottom: 4 },
  babyCardValue: { ...typography.bodyMedium, color: theme.text.primary },
  actionsRow: { flexDirection: 'row', gap: spacing.md, width: '100%' },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: theme.background.surface,
    borderRadius: radius.lg,
    paddingVertical: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border.default,
  },
  actionButtonLabel: { ...typography.footnote, fontWeight: '600' as const, color: theme.text.primary },
  infoCard: {
    width: '100%',
    backgroundColor: theme.background.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border.default,
    gap: spacing.sm,
  },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between' },
  infoLabel: { ...typography.subhead, color: theme.text.secondary },
  infoValue: { ...typography.subhead, color: theme.text.primary },
  privacyNote: { ...typography.caption, color: theme.text.muted },
  blockedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.md },
  blockedRowLabel: { ...typography.footnote, color: theme.text.secondary },
  legalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.sm },
  legalLink: { ...typography.caption, color: theme.text.accent },
  legalDivider: { ...typography.caption, color: theme.text.muted },
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
