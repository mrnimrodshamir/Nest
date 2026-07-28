import React from 'react';
import { View, Text, Image, Pressable, FlatList, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, ProhibitInset } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { StateCard } from '@/components/StateCard';
import { useBlockedUsers, type BlockedUser } from '@/hooks/useBlockedUsers';

interface BlockedUsersScreenProps {
  onBack: () => void;
}

export function BlockedUsersScreen({ onBack }: BlockedUsersScreenProps) {
  const { blockedUsers, isLoading, error, refresh, unblock } = useBlockedUsers();

  const confirmUnblock = (user: BlockedUser) => {
    Alert.alert(`Unblock ${user.displayName}?`, "You'll see their activities and messages again.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Unblock',
        onPress: async () => {
          const err = await unblock(user.id);
          if (err) Alert.alert("Couldn't unblock", err);
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton} accessibilityLabel="Back">
          <ArrowLeft size={20} color={theme.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Blocked members</Text>
        <View style={styles.backButton} />
      </View>

      <FlatList
        data={blockedUsers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={blockedUsers.length === 0 ? styles.emptyContent : styles.listContent}
        refreshing={isLoading}
        onRefresh={refresh}
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
            <Pressable style={styles.unblockButton} onPress={() => confirmUnblock(item)}>
              <Text style={styles.unblockLabel}>Unblock</Text>
            </Pressable>
          </View>
        )}
        ListEmptyComponent={
          !isLoading ? (
            <StateCard
              icon={ProhibitInset}
              title={error ?? "You haven't blocked anyone"}
              body={error ? 'Pull to try again.' : "Members you block won't be able to reach you, and you won't see their activities."}
              ctaLabel={error ? 'Try again' : undefined}
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
