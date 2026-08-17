import React, { useEffect } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Baby, Briefcase, MapPin } from 'phosphor-react-native';
import { PersonCard } from '@/components/PersonCard';
import { PrimaryButton } from '@/components/PrimaryButton';
import { StateCard } from '@/components/StateCard';
import { usePublicProfile } from '@/hooks/usePublicProfile';
import { dateLocaleTag, textAlignForContent, useI18n } from '@/i18n';
import { radius, spacing, theme, typography } from '@/theme';
import { parentRoleKey } from '@/utils/parentRole';
import { buildPublicChildren } from '@/utils/publicFamilyProfile';
import { track } from '@/lib/analytics';

interface PublicProfileScreenProps {
  userId: string;
  onBack: () => void;
  onMessage: (userId: string, displayName: string) => void;
}

/** A factual family introduction. The hook accepts only the privacy-safe
 * public_profiles contract, so exact birthdates, contact details and precise
 * locations cannot reach this screen. Missing optional sections disappear.
 *
 * DIRECTION. App copy follows the UI locale; user-written text — a bio, an
 * occupation, a child's name — follows its OWN script via textAlignForContent,
 * the same rule the rest of the app already uses. Aligning by UI locale instead
 * meant a French bio rendered right-aligned for a Hebrew viewer, and a Hebrew
 * name left-aligned for an English one. */
export function PublicProfileScreen({ userId, onBack, onMessage }: PublicProfileScreenProps) {
  const { profile, isLoading, error } = usePublicProfile(userId);
  const { t, locale, isRTL } = useI18n();
  const children = profile ? buildPublicChildren(profile.childNames, profile.childAgesMonths) : [];
  useEffect(() => {
    track('public_profile_opened');
  }, [userId]);

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Pressable onPress={onBack} style={styles.backButton} accessibilityRole="button" accessibilityLabel={t('common.back')}>
        <ArrowLeft size={20} color={theme.text.primary} style={isRTL ? styles.flipped : undefined} />
      </Pressable>

      {isLoading ? (
        <View style={styles.centerState}><ActivityIndicator color={theme.brand.primary} /></View>
      ) : !profile ? (
        <View style={styles.centerState}>
          <StateCard icon={MapPin} title={error ?? t('profile.notFound')} body={t('profile.deletedAccount')} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          <PersonCard
            size="hero"
            name={profile.ageYears === null ? profile.displayName : `${profile.displayName}, ${profile.ageYears}`}
            avatarUrl={profile.avatarUrl}
            subtitle={[
              t(parentRoleKey(profile.parentRole)),
              profile.neighborhood?.trim() || null,
            ].filter(Boolean).join(' · ') || undefined}
          />

          {children.length ? (
            <ProfileSection title={t('profile.childrenHeading')} icon={Baby}>
              {children.map((child) => (
                <View key={`${child.name}-${child.ageMonths ?? 'unknown'}`} style={styles.childRow}>
                  {/* A child's name follows ITS OWN script, not the UI's. */}
                  <Text style={[styles.childName, textAlignForContent(child.name, locale)]}>{child.name}</Text>
                  {child.ageKey ? (
                    // The age label is app copy, so it follows the UI locale.
                    // numberOfLines={1} keeps a long Russian or French age
                    // ("11 месяцев", "2 ans et demi") from wrapping under a
                    // long name and breaking the row on a small iPhone.
                    <Text style={styles.childAge} numberOfLines={1}>
                      {t(child.ageKey, child.ageCount === null ? undefined : { count: child.ageCount })}
                    </Text>
                  ) : null}
                </View>
              ))}
            </ProfileSection>
          ) : null}

          {profile.occupation?.trim() ? (
            <ProfileSection title={t('profile.occupation')} icon={Briefcase}>
              <Text style={[styles.sectionBody, textAlignForContent(profile.occupation, locale)]}>
                {profile.occupation.trim()}
              </Text>
            </ProfileSection>
          ) : null}
          {profile.bio?.trim() ? (
            <ProfileSection title={t('profile.aboutHeading')}>
              <Text style={[styles.sectionBody, textAlignForContent(profile.bio, locale)]}>
                {profile.bio.trim()}
              </Text>
            </ProfileSection>
          ) : null}

          {profile.sharedActivityTitle ? (
            <View style={styles.sharedContextCard}>
              <Text style={styles.sharedContextText}>{t('profile.sharedActivity', { title: profile.sharedActivityTitle })}</Text>
            </View>
          ) : null}

          <View style={styles.contextRow}>
            <Text style={styles.contextText}>
              {t('profile.memberSince', { date: formatMemberSince(profile.memberSince, dateLocaleTag(locale)) })}
            </Text>
            <Text style={styles.contextText}>
              {t('profile.activityContext', { hosted: profile.hostedCount, joined: profile.joinedCount })}
            </Text>
          </View>

          <View style={styles.messageButton}>
            <PrimaryButton
              label={t('profile.messagePerson', { name: profile.displayName.split(' ')[0] })}
              onPress={() => onMessage(profile.id, profile.displayName)}
            />
          </View>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function formatMemberSince(iso: string, locale: string): string {
  return new Date(iso).toLocaleDateString(locale, { month: 'long', year: 'numeric' });
}

function ProfileSection({ title, icon: Icon, children }: { title: string; icon?: typeof Baby; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        {Icon ? <Icon size={18} color={theme.brand.primary} /> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background.app },
  backButton: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: theme.background.surface,
    alignItems: 'center', justifyContent: 'center', marginStart: spacing.lg, marginTop: spacing.sm,
  },
  flipped: { transform: [{ scaleX: -1 }] },
  centerState: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  content: { padding: spacing['2xl'], paddingTop: spacing.md, gap: spacing.lg },
  section: { borderRadius: radius.lg, backgroundColor: theme.background.surface, padding: spacing.lg, gap: spacing.sm },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  sectionTitle: { ...typography.headline, color: theme.text.primary },
  sectionBody: { ...typography.body, color: theme.text.secondary, lineHeight: 23 },
  childRow: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  childName: { ...typography.bodyMedium, color: theme.text.primary, flex: 1 },
  childAge: { ...typography.subhead, color: theme.text.secondary },
  sharedContextCard: { backgroundColor: theme.brand.primaryTint, borderRadius: radius.md, padding: spacing.md },
  sharedContextText: { ...typography.footnote, color: theme.brand.primaryPressed, textAlign: 'center' },
  contextRow: { alignItems: 'center', gap: spacing.xs },
  contextText: { ...typography.caption, color: theme.text.muted, textAlign: 'center' },
  messageButton: { width: '100%', marginTop: spacing.md },
});
