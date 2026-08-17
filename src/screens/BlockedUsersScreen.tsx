import React from 'react';
import { View, Text, Image, Pressable, FlatList, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ProhibitInset } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { StateCard } from '@/components/StateCard';
import { useBlockedUsers, type BlockedUser } from '@/hooks/useBlockedUsers';
import { useI18n } from '@/i18n';

interface BlockedUsersScreenProps {
  onBack: () => void;
}

export function BlockedUsersScreen({ onBack }: BlockedUsersScreenProps) {
  const { t, isRTL } = useI18n();
  const { blockedUsers, isLoading, error, refresh, unblock } = useBlockedUsers();

  const confirmUnblock = (user: BlockedUser) => {
    Alert.alert(t('blocked.confirmTitle', { name: user.displayName }), t('blocked.confirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('profile.unblock'),
        onPress: async () => {
          const err = await unblock(user.id);
          if (err) Alert.alert(t('blocked.errorTitle'), err);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton} accessibilityLabel={t('common.back')}>
          <ArrowLeft size={20} color={theme.text.primary} style={isRTL ? styles.flipped : undefined} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('profile.blockedMembers')}</Text>
        <View style={styles.backButton} />
      </View>

      <FlatList
        data={blockedUsers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={blockedUsers.length === 0 ? styles.emptyContent : styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.avatar}>
              {item.avatarUrl ? (
                <Image source={{ uri: item.avatarUrl }} style={StyleSheet.absoluteFill} />
              ) : (
                <Text style={styles.avatarInitial}>{item.displayName[0]?.toUpperCase() ?? '?'}</Text>
              )}
            </View>
            <Text style={styles.rowName}>{item.displayName}</Text>
            <Pressable style={styles.unblockButton} onPress={() => confirmUnblock(item)} hitSlop={10}>
              <Text style={styles.unblockLabel}>{t('profile.unblock')}</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          !isLoading ? (
            <StateCard
              icon={ProhibitInset}
              title={error ?? t('blocked.emptyTitle')}
              body={error ? t('myActivities.errorBody') : t('blocked.emptyBody')}
              ctaLabel={error ? t('common.retry') : undefined}
              onCtaPress={error ? refresh : undefined}
              tone={error ? 'warning' : 'default'}
            />
          ) : null
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flipped: { transform: [{ scaleX: -1 }] },
  container: { flex: 1, backgroundColor: theme.background.app },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  backButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: theme.background.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: { ...typography.headline, color: theme.text.primary },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing['4xl'], gap: spacing.sm },
  emptyContent: { flexGrow: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: theme.background.surface,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border.default,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: theme.brand.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarInitial: { ...typography.bodyMedium, color: theme.text.accent },
  rowName: { ...typography.bodyMedium, color: theme.text.primary, flex: 1 },
  unblockButton: { paddingVertical: spacing.xs, paddingHorizontal: spacing.md, borderRadius: radius.sm, backgroundColor: theme.background.app },
  unblockLabel: { ...typography.caption, color: theme.text.accent, fontWeight: '600' as const },
});
