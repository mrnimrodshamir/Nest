import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Pressable, StyleSheet, Dimensions, FlatList, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import MapView, { PROVIDER_DEFAULT, Region } from 'react-native-maps';
import BottomSheet, { BottomSheetFlatList, BottomSheetView } from '@gorhom/bottom-sheet';
import {
  MagnifyingGlass,
  Plus,
  Compass,
  FunnelSimpleX,
  MapPinLine,
  MapTrifold,
  ListBullets,
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
import { useAuth } from '@/hooks/useAuth';
import { PlacesDiscoveryView } from '@/screens/PlacesDiscoveryView';
import type { FamilyFriendlyPlace } from '@/types/familyFriendlyPlace';

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

// Peek = mostly map, a hint of the list — the default, and what Discovery
// always returns to when this tab regains focus. Half = real cards visible
// immediately once expanded. Full = scrollable list, map reduced to a strip.
const SNAP_POINTS = ['22%', '50%', '92%'];
const SHEET_PEEK_INDEX = 0;
const SHEET_HALF_INDEX = 1;
const SHEET_FULL_INDEX = 2;

interface DiscoverScreenProps {
  onOpenActivity: (activity: Activity) => void;
  onOpenPlace: (place: FamilyFriendlyPlace) => void;
  onHostActivity: () => void;
  /** UI-preview escape hatch — when set, the screen never touches location
   *  permissions or Supabase. Never set in production. */
  mockActivities?: Activity[];
  mockPlaces?: FamilyFriendlyPlace[];
}

export function DiscoverScreen({ onOpenActivity, onOpenPlace, onHostActivity, mockActivities, mockPlaces }: DiscoverScreenProps) {
  const { profile } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<ActivityCategory | 'all'>('all');
  const [selectedActivityId, setSelectedActivityId] = useState<string | null>(null);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  // Map and List are two views of the same screen — an explicit toggle,
  // not just an implicit sheet-drag gesture. Plain state, no Reanimated:
  // the segmented pill used to be driven by a shared value, which — inside
  // a screen hosting a BottomSheetFlatList — is exactly the class of
  // Reanimated/native-layout interaction that caused this session's other
  // crashes. A static background swap can't desync from what's on screen.
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');
  const [contentMode, setContentMode] = useState<'activities' | 'places'>('activities');

  const mapRef = useRef<MapView>(null);
  const sheetRef = useRef<BottomSheet>(null);
  const listRef = useRef<React.ElementRef<typeof BottomSheetFlatList>>(null);
  const sheetIndex = useRef(SHEET_PEEK_INDEX);

  const {
    feedActivities,
    radiusExpanded,
    refresh,
    locationDenied,
    isOffline,
    isRefreshing,
    error,
  } = useNearbyActivities(mockActivities ? { mockActivities } : undefined);

  useEffect(() => {
    if (!isRefreshing && !hasLoadedOnce) {
      console.log('[HOME 02] initial data load completed');
      setHasLoadedOnce(true);
    }
  }, [isRefreshing, hasLoadedOnce]);

  // DiscoverScreen stays mounted underneath CreateActivity/ActivityDetail
  // (pushed as root-stack screens over the tabs, not separate tab
  // instances), so every time this tab regains focus: refetch (a newly
  // created/joined activity must appear without an app restart) and reset
  // the sheet + toggle to the same predictable collapsed state — never
  // restore whatever expanded/list state was left behind, which is what
  // made the sheet feel like it "randomly" covered the map on return.
  // Set the moment a focus-triggered refresh is requested; cleared once
  // that refresh actually lands and the map has re-centered on the
  // (possibly changed) result set. Without this, a newly created activity
  // could exist in feedActivities but sit outside the map's current
  // camera position — initialRegion only applies once, at first mount —
  // so it would silently be off-screen until some other action happened
  // to move the camera.
  const pendingRecenter = useRef(false);

  useFocusEffect(
    useCallback(() => {
      pendingRecenter.current = true;
      refresh();
      sheetRef.current?.snapToIndex(SHEET_PEEK_INDEX);
      sheetIndex.current = SHEET_PEEK_INDEX;
      setViewMode('map');
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []),
  );

  const showSkeleton = !hasLoadedOnce && isRefreshing;

  const filteredFeed = useMemo(() => {
    const byCategory =
      selectedCategory === 'all'
        ? feedActivities
        : feedActivities.filter((a) => a.category === selectedCategory);
    const query = searchQuery.trim().toLowerCase();
    const matched = query ? byCategory.filter((a) => a.title.toLowerCase().includes(query)) : byCategory;

    // Soonest first — that's the actual planning question ("what can I join
    // today"), not just "what's nearby". Distance only breaks ties between
    // activities starting at the same time.
    return [...matched].sort((a, b) => {
      const timeDiff = new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
      return timeDiff !== 0 ? timeDiff : a.distanceKm - b.distanceKm;
    });
  }, [feedActivities, selectedCategory, searchQuery]);

  // Deliberately not memoized: DiscoverScreen stays mounted for the whole
  // session, so a useMemo with an empty dependency array (the previous
  // bug) froze this at whatever hour the app happened to first open,
  // never updating to "afternoon"/"evening" as the day went on. Plain
  // recomputation on every render is cheap and always correct.
  const hour = new Date().getHours();
  const timeOfDayGreeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = profile?.displayName?.trim().split(' ')[0];
  const greeting = firstName ? `${timeOfDayGreeting}, ${firstName}` : timeOfDayGreeting;

  const initialRegion: Region = useMemo(() => {
    const first = feedActivities[0];
    return {
      latitude: first?.latitude ?? FALLBACK_LOCATION.latitude,
      longitude: first?.longitude ?? FALLBACK_LOCATION.longitude,
      latitudeDelta: 0.04,
      longitudeDelta: 0.04,
    };
  }, [feedActivities]);

  useEffect(() => {
    if (!pendingRecenter.current || isRefreshing) return;
    pendingRecenter.current = false;
    mapRef.current?.animateToRegion(initialRegion, 350);
  }, [isRefreshing, initialRegion]);

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

  if (contentMode === 'places') {
    return <PlacesDiscoveryView onShowActivities={() => setContentMode('activities')} onOpenPlace={onOpenPlace} mockPlaces={mockPlaces} />;
  }

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
        {!searchOpen && <View style={styles.contentToggle}>
          <View style={[styles.contentToggleOption, styles.contentToggleSelected]}><Text style={[styles.contentToggleText, styles.contentToggleTextSelected]}>Activities</Text></View>
          <Pressable style={styles.contentToggleOption} onPress={() => setContentMode('places')}><Text style={styles.contentToggleText}>Places</Text></Pressable>
        </View>}
        {searchOpen ? (
          <View style={styles.searchRow}>
            <MagnifyingGlass size={iconDefaults.size.inline} color={theme.text.muted} weight={iconDefaults.weight} />
            <TextInput
              style={[styles.searchInput, styles.searchInputLtr]}
              placeholder="Search activities"
              placeholderTextColor={theme.text.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              returnKeyType="search"
              textAlign="left"
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
            <Text style={styles.greeting}>{greeting}</Text>
            <View style={styles.headerActions}>
              <View style={styles.viewToggle}>
                <Pressable
                  style={[styles.viewToggleOption, viewMode === 'map' && styles.viewToggleOptionSelected]}
                  onPress={() => {
                    setViewMode('map');
                    sheetIndex.current = SHEET_PEEK_INDEX;
                    sheetRef.current?.snapToIndex(SHEET_PEEK_INDEX);
                  }}
                  accessibilityLabel="Map view"
                  accessibilityState={{ selected: viewMode === 'map' }}
                >
                  <MapTrifold size={16} color={viewMode === 'map' ? theme.text.inverse : theme.text.secondary} weight={iconDefaults.weight} />
                </Pressable>
                <Pressable
                  style={[styles.viewToggleOption, viewMode === 'list' && styles.viewToggleOptionSelected]}
                  onPress={() => {
                    setViewMode('list');
                    sheetIndex.current = SHEET_FULL_INDEX;
                    sheetRef.current?.snapToIndex(SHEET_FULL_INDEX);
                  }}
                  accessibilityLabel="List view"
                  accessibilityState={{ selected: viewMode === 'list' }}
                >
                  <ListBullets size={16} color={viewMode === 'list' ? theme.text.inverse : theme.text.secondary} weight={iconDefaults.weight} />
                </Pressable>
              </View>
              <Pressable style={styles.iconButton} onPress={() => setSearchOpen(true)} accessibilityLabel="Search">
                <MagnifyingGlass size={iconDefaults.size.tabBar - 4} color={theme.text.primary} weight={iconDefaults.weight} />
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
        index={SHEET_PEEK_INDEX}
        snapPoints={SNAP_POINTS}
        enableDynamicSizing={false}
        onChange={(index) => {
          sheetIndex.current = index;
          setViewMode(index >= SHEET_FULL_INDEX ? 'list' : 'map');
        }}
        backgroundStyle={styles.sheetBackground}
        handleIndicatorStyle={styles.sheetHandle}
      >
        <BottomSheetView style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>
            {showSkeleton ? 'Finding activities…' : `${filteredFeed.length} nearby`}
          </Text>
          {!showSkeleton && filteredFeed.length > 0 && (
            <Text style={styles.sheetSubtitle}>Swipe up to see them all</Text>
          )}
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
      title={radiusExpanded ? 'No activities nearby yet' : 'Nothing nearby just yet'}
      body={
        radiusExpanded
          ? 'Be the first to host an activity in your area.'
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
  contentToggle: { alignSelf: 'center', flexDirection: 'row', padding: 3, borderRadius: radius.pill, backgroundColor: theme.background.surface, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  contentToggleOption: { minWidth: 104, minHeight: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  contentToggleSelected: { backgroundColor: theme.brand.primary },
  contentToggleText: { ...typography.subhead, color: theme.text.secondary, fontWeight: '600' },
  contentToggleTextSelected: { color: theme.text.inverse },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  greeting: {
    ...typography.bodyMedium,
    color: theme.text.primary,
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
  searchInputLtr: { writingDirection: 'ltr' },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: theme.background.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewToggle: {
    flexDirection: 'row',
    backgroundColor: theme.background.surface,
    borderRadius: radius.md,
    padding: 3,
    gap: 2,
  },
  viewToggleOption: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  viewToggleOptionSelected: { backgroundColor: theme.brand.primary },
  chipRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.md },
  fab: {
    position: 'absolute',
    right: spacing.xl,
    bottom: SCREEN_HEIGHT * 0.25 + spacing.xl, // sits just above the default ~22% peek sheet
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
  sheetSubtitle: { ...typography.footnote, color: theme.text.secondary, marginTop: 2 },
  listContent: { paddingBottom: spacing['6xl'] },
  feedItem: { paddingHorizontal: spacing.lg },
});
