import React from 'react';
import { View, Text, ActivityIndicator, ScrollView, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, MapPin } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { PersonCard } from '@/components/PersonCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { StateCard } from '@/components/StateCard';
import { usePublicProfile } from '@/hooks/usePublicProfile';
import { formatBabyAge } from '@/utils/babyAge';

interface PublicProfileScreenProps {
  userId: string;
  onBack: () => void;
  onMessage: (userId: string, displayName: string) => void;
}

/** See who you'd be meeting, before you join. No phone-verified badge, no
 *  trust score, no ranking -- just a name, a photo (or a branded initial),
 *  when they joined Momzi, and factual hosted/joined context shown small. */
export function PublicProfileScreen({ userId, onBack, onMessage }: PublicProfileScreenProps) {
  const { profile, isLoading, error } = usePublicProfile(userId);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Pressable onPress={onBack} style={styles.backButton} accessibilityLabel="Back">
        <ArrowLeft size={20} color={theme.text.primary} />
      </Pressable>

      {isLoading ? (
        <View style={styles.centerState}>
          <ActivityIndicator color={theme.brand.primary} />
        </View>
      ) : !profile ? (
        <View style={styles.centerState}>
          <StateCard
            icon={MapPin}
            title={error ?? 'This member could not be found'}
            body="They may have deleted their account."
          />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <PersonCard
            size="hero"
            name={profile.displayName}
            avatarUrl={profile.avatarUrl}
            subtitle={
              profile.childName
                ? `Parent of ${profile.childName}${
                    profile.childAgeMonths !== null ? ` · ${formatBabyAge(profile.childAgeMonths)}` : ''
                  }`
                : undefined
            }
          />

          {profile.sharedContext && (
            <View style={styles.sharedContextCard}>
              <Text style={styles.sharedContextText}>{profile.sharedContext}</Text>
            </View>
          )}

          <View style={styles.contextRow}>
            <Text style={styles.contextText}>Member since {formatMemberSince(profile.memberSince)}</Text>
            <Text style={styles.contextDivider}>·</Text>
            <Text style={styles.contextText}>
              Hosted {profile.hostedCount} · Joined {profile.joinedCount}
            </Text>
          </View>

          <View style={styles.messageButton}>
            <PrimaryButton label={`Message ${profile.displayName.split(' ')[0]}`} onPress={() => onMessage(profile.id, profile.displayName)} />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function formatMemberSince(iso: string): string {
  const date = new Date(iso);
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background.app },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.background.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: spacing.lg,
    marginTop: spacing.sm,
  },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { alignItems: 'center', padding: spacing['2xl'], paddingTop: spacing.md, gap: spacing.lg },
  sharedContextCard: {
    backgroundColor: theme.brand.primaryTint,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  sharedContextText: { ...typography.footnote, color: theme.brand.primaryPressed, textAlign: 'center' },
  contextRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  contextText: { ...typography.caption, color: theme.text.muted },
  contextDivider: { ...typography.caption, color: theme.text.muted },
  messageButton: { width: '100%', marginTop: spacing.md },
});
