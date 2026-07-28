import React, { useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ArrowLeft, Compass } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { ActivityCard } from '@/components/ActivityCard';
import { StateCard } from '@/components/StateCard';
import { SkeletonCard } from '@/components/SkeletonCard';
import { useMyActivities, type MyActivity } from '@/hooks/useMyActivities';
import type { Activity } from '@/types/activity';

interface MyActivitiesScreenProps {
  onBack: () => void;
  onOpenActivity: (activity: Activity) => void;
}

type Tab = 'upcoming' | 'past';

export function MyActivitiesScreen({ onBack, onOpenActivity }: MyActivitiesScreenProps) {
  const [tab, setTab] = useState<Tab>('upcoming');
  const { upcoming, past, isLoading, error, refresh } = useMyActivities();
  const list = tab === 'upcoming' ? upcoming : past;

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton} accessibilityLabel="Back">
          <ArrowLeft size={20} color={theme.text.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>My Activities</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tab, tab === 'upcoming' && styles.tabSelected]}
          onPress={() => setTab('upcoming')}
        >
          <Text style={[styles.tabLabel, tab === 'upcoming' && styles.tabLabelSelected]}>Upcoming</Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === 'past' && styles.tabSelected]} onPress={() => setTab('past')}>
          <Text style={[styles.tabLabel, tab === 'past' && styles.tabLabelSelected]}>Past</Text>
        </Pressable>
      </View>

      {isLoading ? (
        <View style={styles.listContent}>
          {[0, 1, 2].map((i) => (
            <SkeletonCard key={i} />
          ))}
        </View>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(item) => item.id}
          contentContainerStyle={list.length === 0 ? styles.emptyContent : styles.listContent}
          renderItem={({ item }) => <MyActivityRow activity={item} onPress={() => onOpenActivity(item)} />}
          ListEmptyComponent={
            <StateCard
              icon={Compass}
              title={error ?? (tab === 'upcoming' ? 'Nothing coming up' : 'No past activities yet')}
              body={
                error
                  ? 'Pull to refresh and try again.'
                  : tab === 'upcoming'
                    ? "Once you join or host an activity, it'll show up here."
                    : "Activities you've joined or hosted will move here once they've happened."
              }
              ctaLabel={error ? 'Try again' : undefined}
              onCtaPress={error ? refresh : undefined}
              tone={error ? 'warning' : 'default'}
            />
          }
        />
      )}
    </SafeAreaView>
  );
}

function MyActivityRow({ activity, onPress }: { activity: MyActivity; onPress: () => void }) {
  return (
    <View style={styles.cardWrap}>
      <View style={[styles.roleTag, activity.role === 'hosting' ? styles.roleTagHosting : styles.roleTagGoing]}>
        <Text style={[styles.roleTagLabel, activity.role === 'hosting' && styles.roleTagLabelHosting]}>
          {activity.role === 'hosting' ? 'Hosting' : 'Going'}
        </Text>
      </View>
      <ActivityCard activity={activity} onPress={onPress} variant="feed" hideDistance />
    </View>
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
  tabRow: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  tab: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: theme.background.surface,
    borderWidth: 1,
    borderColor: theme.border.default,
  },
  tabSelected: { backgroundColor: theme.brand.primary, borderColor: theme.brand.primary },
  tabLabel: { ...typography.footnote, fontWeight: '600' as const, color: theme.text.secondary },
  tabLabelSelected: { color: theme.text.inverse },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: spacing['4xl'], gap: spacing.sm },
  emptyContent: { flexGrow: 1 },
  cardWrap: { position: 'relative' },
  roleTag: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.sm + spacing.lg,
    zIndex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  roleTagHosting: { backgroundColor: theme.brand.secondaryTint },
  roleTagGoing: { backgroundColor: theme.brand.primaryTint },
  roleTagLabel: { ...typography.caption, color: theme.brand.primaryPressed },
  roleTagLabelHosting: { color: theme.brand.secondary },
});
