import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions, FlatList, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { PROVIDER_DEFAULT, Region } from 'react-native-maps';
import BottomSheet, { BottomSheetFlatList, BottomSheetView } from '@gorhom/bottom-sheet';
import {
  ChatCircleDots,
  MagnifyingGlass,
  Plus,
  UserCircle,
  Compass,
  FunnelSimpleX,
  MapPinLine,
  WifiSlash,
  WarningCircle,
  X,
} from 'phosphor-react-native';
import { theme, typography, spacing, radius, iconDefaults } from '@/theme';
import { ActivityCard } from '@/components/ActivityCard';
import { ActivityMapPin } from '@/components/ActivityMapPin';
import { CategoryChip } from '@/components/CategoryChip';
import { StateCard } from '@/components/StateCard';
import { SkeletonCard } from '@/components/SkeletonCard';
import { FALLBACK_LOCATION } from '@/constants/location';
import type { Activity, ActivityCategory } from '@/types/activity';
import { CATEGORY_LABELS } from '@/types/activity';
import { useNearbyActivities } from '@/hooks/useNearbyActivities';

const CATEGORIES: Array<{ key: ActivityCategory | 'all'; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'stroller_walk', label: CATEGORY_LABELS.stroller_walk },
  { key: 'coffee_meetup', label: CATEGORY_LABELS.coffee_meetup },
  { key: 'baby_playtime', label: CATEGORY_LABELS.baby_playtime },
  { key: 'picnic', label: CATEGORY_LABELS.picnic },
  { key: 'fitness', label: CATEGORY_LABELS.fitness },
  { key: 'yoga', label: CATEGORY_LABELS.yoga },
  { key: 'workshop', label: CATEGORY_LABELS.workshop },
];

// Peek = mostly map, a hint of the list. Half = default — real cards visible
// immediately even in a sparse market, map still gives spatial context.
// Full = scrollable list, map reduced to a strip.
const SNAP_POINTS = ['15%', '50%', '92%'];
const SHEET_PEEK_INDEX = 0;
const SHEET_HALF_INDEX = 1;

interface DiscoverScreenProps {
  onOpenActivity: (activity: Activity) => void;
  onOpenMessages: () => void;
  onOpenProfile: () => void;
  onHostActivity: () => void;
}

export function DiscoverScreen({
  onOpenActivity,
  onOpenMessages,
  onOpenProfile,
  onHostActivity,
}: DiscoverScreenProps) {
  const [selectedCategory, setSelectedCategory] = useState<ActivityCategory | 'all'>('all');
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const mapRef = useRef<MapView>(null);
  const sheetRef = useRef<BottomSheet>(null);
  const listRef = useRef<React.ElementRef<typeof BottomSheetFlatList>>(null);
  const sheetIndex = useRef(SHEET_HALF_INDEX);

  const {
    feedActivities,
    radiusExpanded,
    refresh,
    locationLabel,
    locationDenied,
    isOffline,
    isRefreshing,
    error,
  } = useNearbyActivities();

  useEffect(() => {
    if (!isRefreshing) setHasLoadedOnce(true);
  }, [isRefreshing]);

  const showSkeleton = !hasLoadedOnce && isRefreshing;

  const filteredFeed = useMemo(() => {
    const byCategory =
      selectedCategory === 'all'
        ? feedActivities
        : feedActivities.filter((a) => a.category === selectedCategory);
    const query = searchQuery.trim().toLowerCase();
    if (!query) return byCategory;
    return byCategory.filter((a) => a.title.toLowerCase().includes(query));
  }, [feedActivities, selectedCategory, searchQuery]);

  const initialRegion: Region = useMemo(() => {
    const first = feedActivities[0];
    return {
      latitude: first?.latitude ?? FALLBACK_LOCATION.latitude,
      longitude: first?.longitude ?? FALLBACK_LOCATION.longitude,
      latitudeDelta: 0.04,
      longitudeDelta: 0.04,
    };
  }, [feedActivities]);

  const focusMapOn = useCallback((activity: Activity) => {
    mapRef.current?.animateToRegion(
      {
        latitude: activity.latitude,
        longitude: activity.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      350,
    );
  }, []);

  const handlePinPress = useCallback(
    (activity: Activity) => {
      setSelectedActivityId(activity.id);
      focusMapOn(activity);

      if (sheetIndex.current === SHEET_PEEK_INDEX) {
        sheetRef.current?.snapToIndex(SHEET_HALF_INDEX);
      }
      const index = filteredFeed.findIndex((a) => a.id === activity.id);
      if (index >= 0) {
        listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.2 });
      }
    },
    [filteredFeed, focusMapOn],
  );

  const handleCardSelect = useCallback(
    (activity: Activity) => {
      setSelectedActivityId(activity.id);
      focusMapOn(activity);
    },
    [focusMapOn],
  );

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {feedActivities.map((activity) => (
          <ActivityMapPin
            key={activity.id}
            activity={activity}
            selected={activity.id === selectedActivityId}
            onPress={handlePinPress}
          />
        ))}
      </MapView>

      <SafeAreaView edges={['top']} style={styles.headerOverlay} pointerEvents="box-none">
        {searchOpen ? (
          <View style={styles.searchRow}>
            <MagnifyingGlass size={16} color={theme.text.muted} weight={iconDefaults.weight} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search activities"
              placeholderTextColor={theme.text.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              returnKeyType="search"
            />
            <Pressable
              onPress={() => {
                setSearchOpen(false);
                setSearchQuery('');
              }}
              accessibilityLabel="Close search"
              hitSlop={8}
            >
              <X size={16} color={theme.text.secondary} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.headerRow}>
            <Text style={styles.locationLabel}>{locationLabel}</Text>
            <View style={styles.headerActions}>
              <Pressable style={styles.iconButton} onPress={() => setSearchOpen(true)} accessibilityLabel="Search">
                <MagnifyingGlass size={iconDefaults.size.tabBar - 4} color={theme.text.primary} weight={iconDefaults.weight} />
              </Pressable>
              <Pressable style={styles.iconButton} onPress={onOpenMessages} accessibilityLabel="Messages">
                <ChatCircleDots size={iconDefaults.size.tabBar - 4} color={theme.text.primary} weight={iconDefaults.weight} />
              </Pressable>
              <Pressable style={styles.iconButton} onPress={onOpenProfile} accessibilityLabel="Profile">
                <UserCircle size={iconDefaults.size.tabBar - 4} color={theme.text.primary} weight={iconDefaults.weight} />
              </Pressable>
            </View>
          </View>
        )}

        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={CATEGORIES}
          keyExtractor={(item: (typeof CATEGORIES)[number]) => item.key}
          contentContainerStyle={styles.chipRow}
          renderItem={({ item }: { item: (typeof CATEGORIES)[number] }) => (
            <CategoryChip
              label={item.label}
              selected={selectedCategory === item.key}
              onPress={() => setSelectedCategory(item.key)}
            />
          )}
        />
      </SafeAreaView>

      <Pressable style={styles.fab} onPress={onHostActivity} accessibilityLabel="Host an activity">
        <Plus size={24} color={theme.text.inverse} weight="bold" />
      </Pressable>

      <BottomSheet
        ref={sheetRef}
        index={SHEET_HALF_INDEX}
        snapPoints={SNAP_POINTS}
        enableDynamicSizing={false}
        onChange={(index) => {
          sheetIndex.current = index;
        }}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
      >
        <BottomSheetView style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>
            {showSkeleton ? 'Finding activities…' : `${filteredFeed.length} nearby`}
          </Text>
        </BottomSheetView>

        {showSkeleton ? (
          <BottomSheetView style={styles.listContent}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={styles.feedItem}>
                <SkeletonCard />
              </View>
            ))}
          </BottomSheetView>
        ) : (
          <BottomSheetFlatList
            ref={listRef}
            data={filteredFeed}
            keyExtractor={(item: (typeof filteredFeed)[number]) => item.id}
            renderItem={({ item }: { item: (typeof filteredFeed)[number] }) => (
              <View style={styles.feedItem}>
                <ActivityCard
                  activity={item}
                  variant="feed"
                  onPress={() => {
                    handleCardSelect(item);
                    onOpenActivity(item);
                  }}
                  highlighted={item.id === selectedActivityId}
                />
              </View>
            )}
            ListEmptyComponent={
              <DiscoverEmptyState
                isOffline={isOffline}
                error={error}
                hasCategoryFilter={selectedCategory !== 'all'}
                hasAnyActivities={feedActivities.length > 0}
                locationDenied={locationDenied}
                radiusExpanded={radiusExpanded}
                onRetry={refresh}
                onClearFilter={() => setSelectedCategory('all')}
                onHostPress={onHostActivity}
              />
            }
            contentContainerStyle={styles.listContent}
            onRefresh={refresh}
            refreshing={hasLoadedOnce && isRefreshing}
          />
        )}
      </BottomSheet>
    </View>
  );
}

interface DiscoverEmptyStateProps {
  isOffline: boolean;
  error: string | null;
  hasCategoryFilter: boolean;
  hasAnyActivities: boolean;
  locationDenied: boolean;
  radiusExpanded: boolean;
  onRetry: () => void;
  onClearFilter: () => void;
  onHostPress: () => void;
}

/** Priority order matters: offline and error are true dead-ends (nothing
 *  loaded at all) and must win over anything else. A category filter with
 *  zero matches is a different problem ("relax your filter") from truly
 *  nothing nearby ("be the first"), so it's checked before falling all the
 *  way through to that floor state. */
function DiscoverEmptyState({
  isOffline,
  error,
  hasCategoryFilter,
  hasAnyActivities,
  locationDenied,
  radiusExpanded,
  onRetry,
  onClearFilter,
  onHostPress,
}: DiscoverEmptyStateProps) {
  if (isOffline) {
    return (
      <StateCard
        icon={WifiSlash}
        title="You're offline"
        body="We'll refresh the moment you're back online."
        tone="warning"
      />
    );
  }

  if (error) {
    return (
      <StateCard
        icon={WarningCircle}
        title="Couldn't load activities"
        body={error}
        ctaLabel="Try again"
        onCtaPress={onRetry}
        tone="warning"
      />
    );
  }

  if (hasCategoryFilter && hasAnyActivities) {
    return (
      <StateCard
        icon={FunnelSimpleX}
        title="No activities match your filters"
        body="Try a different category, or clear the filter to see everything nearby."
        ctaLabel="Clear filter"
        onCtaPress={onClearFilter}
      />
    );
  }

  if (locationDenied) {
    return (
      <StateCard
        icon={MapPinLine}
        title="Enable location to discover activities near you"
        body="We're showing a default area for now. Turn on location access in Settings to see what's actually nearby."
      />
    );
  }

  return (
    <StateCard
      icon={Compass}
      title={radiusExpanded ? 'Be the first here' : 'Nothing nearby just yet'}
      body={
        radiusExpanded
          ? 'No one has hosted near you yet — the easiest way to meet mothers close by is to start something small yourself.'
          : "We're widening your search radius to find something for you."
      }
      ctaLabel={radiusExpanded ? 'Host an activity' : undefined}
      onCtaPress={radiusExpanded ? onHostPress : undefined}
    />
  );
}

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background.app },
  headerOverlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  locationLabel: {
    ...typography.bodyMedium,
    color: theme.text.primary,
    backgroundColor: theme.background.surface,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    backgroundColor: theme.background.surface,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    height: 40,
  },
  searchInput: { flex: 1, ...typography.subhead, color: theme.text.primary, height: '100%' },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: theme.background.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: SCREEN_HEIGHT * 0.5 + spacing.xl, // sits above the default half-open sheet
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: theme.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetBackground: { backgroundColor: theme.background.surface, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl },
  sheetHandle: { backgroundColor: theme.border.strong, width: 36 },
  sheetHeader: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  sheetTitle: { ...typography.headline, color: theme.text.primary },
  listContent: { paddingBottom: spacing['6xl'] },
  feedItem: { paddingHorizontal: spacing.lg },
});
