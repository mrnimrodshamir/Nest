import React, { useCallback, useState } from 'react';
import { View, Text, Pressable, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { ArrowLeft, Compass } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { ActivityCard } from '@/components/ActivityCard';
import { StateCard } from '@/components/StateCard';
import { SkeletonCard } from '@/components/SkeletonCard';
import { useMyActivities, type MyActivity } from '@/hooks/useMyActivities';
import type { Activity } from '@/types/activity';
import { useI18n } from '@/i18n';

interface MyActivitiesScreenProps {
  onBack: () => void;
  onOpenActivity: (activity: Activity) => void;
}

type Tab = 'upcoming' | 'past';

export function MyActivitiesScreen({ onBack, onOpenActivity }: MyActivitiesScreenProps) {
  const { t, isRTL } = useI18n();
  const [tab, setTab] = useState<Tab>('upcoming');
  const { upcoming, past, isLoading, error, refresh } = useMyActivities();
  const list = tab === 'upcoming' ? upcoming : past;

  // This screen stays mounted underneath Activity Detail when navigated to
  // — without this, joining/leaving/editing/cancelling an activity there
  // never updates this list until something else forces a remount.
  useFocusEffect(
    useCallback(() => {
      refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Pressable onPress={onBack} style={styles.backButton} accessibilityLabel={t('common.back')}>
          <ArrowLeft size={20} color={theme.text.primary} style={isRTL ? styles.flipped : undefined} />
        </Pressable>
        <Text style={styles.headerTitle}>{t('nav.myActivities')}</Text>
        <View style={styles.backButton} />
      </View>

      <View style={styles.tabRow}>
        <Pressable
          style={[styles.tab, tab === 'upcoming' && styles.tabSelected]}
          onPress={() => setTab('upcoming')}
        >
          <Text style={[styles.tabLabel, tab === 'upcoming' && styles.tabLabelSelected]}>{t('myActivities.upcoming')}</Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === 'past' && styles.tabSelected]} onPress={() => setTab('past')}>
          <Text style={[styles.tabLabel, tab === 'past' && styles.tabLabelSelected]}>{t('myActivities.past')}</Text>
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
              title={error ?? t(tab === 'upcoming' ? 'myActivities.emptyUpcomingTitle' : 'myActivities.emptyPastTitle')}
              body={
                error
                  ? t('myActivities.errorBody')
                  : tab === 'upcoming'
                    ? t('myActivities.emptyUpcomingBody')
                    : t('myActivities.emptyPastBody')
              }
              ctaLabel={error ? t('common.retry') : undefined}
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
    <View>
      <ActivityCard
        activity={activity}
        onPress={onPress}
        variant="feed"
        hideDistance
        relationship={activity.role === 'hosting' ? 'hosting' : 'joined'}
      />
    </View>
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
});
