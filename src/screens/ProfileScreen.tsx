import React from 'react';
import { View, Text, Image, Pressable, Switch, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, SignOut } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { useAuth } from '@/hooks/useAuth';
import { ensurePushRegistration } from '@/hooks/usePushNotifications';
import { birthdateToMonths, formatBabyAge } from '@/utils/babyAge';
import type { NotificationPreferences } from '@/types/profile';

interface ProfileScreenProps {
  onBack: () => void;
}

const NOTIFICATION_LABELS: Record<keyof NotificationPreferences, string> = {
  activity_changes: 'Activity updates',
  chat_messages: 'New messages',
  reminders: 'Reminders before activities',
};

export function ProfileScreen({ onBack }: ProfileScreenProps) {
  const { profile, signOut, updateNotificationPreferences } = useAuth();

  const babyAgeLabel = profile?.babyBirthdate
    ? formatBabyAge(birthdateToMonths(profile.babyBirthdate))
    : null;

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
              <Text style={styles.avatarInitial}>
                {profile?.displayName?.[0]?.toUpperCase() ?? '?'}
              </Text>
            </View>
          )}
        </View>

        <Text style={styles.name}>{profile?.displayName ?? 'Momzi member'}</Text>
        <Text style={styles.email}>{profile?.email}</Text>

        {profile?.babyName && (
          <View style={styles.babyCard}>
            <Text style={styles.babyCardLabel}>Baby</Text>
            <Text style={styles.babyCardValue}>
              {profile.babyName}
              {babyAgeLabel ? ` · ${babyAgeLabel}` : ''}
            </Text>
          </View>
        )}

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
                  onValueChange={(value) => {
                    void updateNotificationPreferences({
                      ...profile.notificationPreferences,
                      [key]: value,
                    });
                    // Reminders is one of only two moments allowed to trigger
                    // the OS notification permission prompt (the other is
                    // joining a first activity) — never proactively.
                    if (key === 'reminders' && value) {
                      void ensurePushRegistration(true);
                    }
                  }}
                  trackColor={{ true: theme.brand.primary, false: theme.border.default }}
                />
              </View>
            ))}
          </View>
        )}

        <Pressable style={styles.signOutButton} onPress={signOut}>
          <SignOut size={18} color={theme.semantic.danger} />
          <Text style={styles.signOutLabel}>Sign out</Text>
        </Pressable>
      </ScrollView>
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
  email: { ...typography.subhead, color: theme.text.secondary, marginBottom: spacing.md },
  babyCard: {
    width: '100%',
    backgroundColor: theme.background.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border.default,
  },
  babyCardLabel: { ...typography.caption, color: theme.text.muted, marginBottom: 4 },
  babyCardValue: { ...typography.bodyMedium, color: theme.text.primary },
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
  signOutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing['2xl'],
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  signOutLabel: { ...typography.bodyMedium, color: theme.semantic.danger },
});
