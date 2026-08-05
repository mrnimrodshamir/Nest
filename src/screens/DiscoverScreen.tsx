import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { PROVIDER_DEFAULT, type Region } from 'react-native-maps';
import BottomSheet, { BottomSheetFlatList, BottomSheetView } from '@gorhom/bottom-sheet';
import {
  MagnifyingGlass,
  MapTrifold,
  ListBullets,
  Plus,
  WarningCircle,
  X,
} from 'phosphor-react-native';
import { ActivityCard } from '@/components/ActivityCard';
import { ActivityMapPin } from '@/components/ActivityMapPin';
import { CategoryChip } from '@/components/CategoryChip';
import { PlaceCard } from '@/components/PlaceCard';
import { PlaceClusterMarker } from '@/components/PlaceClusterMarker';
import { PlaceMapPin } from '@/components/PlaceMapPin';
import { SkeletonCard } from '@/components/SkeletonCard';
import { FALLBACK_LOCATION } from '@/constants/location';
import { useAuth } from '@/hooks/useAuth';
import { useDiscoveryPosition } from '@/hooks/useDiscoveryPosition';
import { useFamilyFriendlyPlaces } from '@/hooks/useFamilyFriendlyPlaces';
import { useNearbyActivities } from '@/hooks/useNearbyActivities';
import { radius, spacing, theme, typography, iconDefaults } from '@/theme';
import type { Activity, ActivityCategory } from '@/types/activity';
import { CATEGORY_LABELS } from '@/types/activity';
import type { DiscoveryContentFilter, DiscoveryItem, DiscoverySelection } from '@/types/discovery';
import type { FamilyFriendlyPlace, PlaceCategory, PlaceFilters } from '@/types/familyFriendlyPlace';
import { PLACE_CATEGORY_LABELS } from '@/types/familyFriendlyPlace';
import { clusterPlacesForRegion } from '@/utils/placeClustering';
import { regionToPlaceViewport } from '@/utils/placeViewport';
import {
  discoveryItemKey,
  discoverySelectionEquals,
  filterDiscoveryItems,
  mergeDiscoveryItems,
} from '@/utils/unifiedDiscovery';

const ACTIVITY_CATEGORIES: Array<{ key: ActivityCategory | 'all'; label: string }> = [
  { key: 'all', label: 'All activities' },
  { key: 'stroller_walk', label: CATEGORY_LABELS.stroller_walk },
  { key: 'coffee_meetup', label: CATEGORY_LABELS.coffee_meetup },
  { key: 'baby_playtime', label: CATEGORY_LABELS.baby_playtime },
  { key: 'picnic', label: CATEGORY_LABELS.picnic },
  { key: 'fitness', label: CATEGORY_LABELS.fitness },
  { key: 'yoga', label: CATEGORY_LABELS.yoga },
  { key: 'workshop', label: CATEGORY_LABELS.workshop },
];

const PLACE_CATEGORIES: Array<{ key: PlaceCategory | 'all'; label: string }> = [
  { key: 'all', label: 'All places' },
  { key: 'playground', label: 'Playgrounds' },
  { key: 'park', label: 'Parks' },
  { key: 'indoor_playground', label: 'Indoor play' },
  { key: 'museum', label: 'Museums' },
  { key: 'beach', label: 'Beaches' },
  { key: 'pool', label: 'Pools' },
];

const CONTENT_FILTERS: Array<{ key: DiscoveryContentFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'activities', label: 'Activities' },
  { key: 'places', label: 'Places' },
];

type PlaceQuickFilter =
  | 'babies' | 'toddlers' | 'kids'
  | 'indoor' | 'outdoor' | 'free' | 'paid'
  | 'changingTable' | 'toilets' | 'highChairs' | 'shade' | 'waterFountain' | 'accessible';

const PLACE_QUICK_FILTERS: Array<{ key: PlaceQuickFilter; label: string }> = [
  { key: 'babies', label: 'Babies' }, { key: 'toddlers', label: 'Toddlers' }, { key: 'kids', label: 'Kids' },
  { key: 'indoor', label: 'Indoor' }, { key: 'outdoor', label: 'Outdoor' },
  { key: 'free', label: 'Free' }, { key: 'paid', label: 'Paid' },
  { key: 'changingTable', label: 'Changing table' }, { key: 'toilets', label: 'Toilets' },
  { key: 'highChairs', label: 'High chairs' }, { key: 'shade', label: 'Shade' },
  { key: 'waterFountain', label: 'Water' }, { key: 'accessible', label: 'Accessible' },
];

const SNAP_POINTS = ['22%', '50%', '92%'];
const SHEET_PEEK_INDEX = 0;
const SHEET_HALF_INDEX = 1;
const SHEET_FULL_INDEX = 2;

interface DiscoverScreenProps {
  onOpenActivity: (activity: Activity) => void;
  onOpenPlace: (place: FamilyFriendlyPlace) => void;
  onHostActivity: () => void;
  mockActivities?: Activity[];
  mockPlaces?: FamilyFriendlyPlace[];
}

export function DiscoverScreen({ onOpenActivity, onOpenPlace, onHostActivity, mockActivities, mockPlaces }: DiscoverScreenProps) {
  const { profile } = useAuth();
  const previewMode = mockActivities !== undefined || mockPlaces !== undefined;
  const initialCoordinate = mockActivities?.[0] ?? mockPlaces?.[0] ?? FALLBACK_LOCATION;
  const [region, setRegion] = useState<Region>({
    latitude: initialCoordinate.latitude,
    longitude: initialCoordinate.longitude,
    latitudeDelta: 0.04,
    longitudeDelta: 0.04,
  });
  const [contentFilter, setContentFilter] = useState<DiscoveryContentFilter>('all');
  const [selectedItem, setSelectedItem] = useState<DiscoverySelection>(null);
  const [selectedActivityCategory, setSelectedActivityCategory] = useState<ActivityCategory | 'all'>('all');
  const [selectedPlaceCategory, setSelectedPlaceCategory] = useState<PlaceCategory | 'all'>('all');
  const [placeQuickFilters, setPlaceQuickFilters] = useState<Set<PlaceQuickFilter>>(() => new Set());
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'map' | 'list'>('map');

  const mapRef = useRef<MapView>(null);
  const sheetRef = useRef<BottomSheet>(null);
  const listRef = useRef<React.ElementRef<typeof BottomSheetFlatList>>(null);
  const sheetIndex = useRef(SHEET_PEEK_INDEX);
  const userMovedMap = useRef(false);
  const centeredOnUser = useRef(false);

  const position = useDiscoveryPosition(!previewMode);
  const viewport = useMemo(() => regionToPlaceViewport(region), [region]);
  const placeFilters = useMemo<PlaceFilters>(() => ({
    category: selectedPlaceCategory === 'all' ? null : selectedPlaceCategory,
    ageMonths: placeQuickFilters.has('babies') ? 12 : placeQuickFilters.has('toddlers') ? 36 : placeQuickFilters.has('kids') ? 72 : null,
    environment: placeQuickFilters.has('indoor') ? 'indoor' : placeQuickFilters.has('outdoor') ? 'outdoor' : null,
    cost: placeQuickFilters.has('free') ? 'free' : placeQuickFilters.has('paid') ? 'paid' : null,
    changingTable: placeQuickFilters.has('changingTable'),
    toilets: placeQuickFilters.has('toilets'),
    highChairs: placeQuickFilters.has('highChairs'),
    shade: placeQuickFilters.has('shade'),
    waterFountain: placeQuickFilters.has('waterFountain'),
    accessible: placeQuickFilters.has('accessible'),
  }), [placeQuickFilters, selectedPlaceCategory]);

  const activitiesQuery = useNearbyActivities({
    mockActivities,
    queryCenter: { latitude: region.latitude, longitude: region.longitude },
  });
  const placesQuery = useFamilyFriendlyPlaces({
    enabled: true,
    viewport,
    filters: placeFilters,
    userCoordinate: position.userCoordinate,
    mockPlaces,
  });
  const activityRefreshRef = useRef(activitiesQuery.refresh);
  const placeRefreshRef = useRef(placesQuery.refresh);
  activityRefreshRef.current = activitiesQuery.refresh;
  placeRefreshRef.current = placesQuery.refresh;

  useEffect(() => {
    if (!position.userCoordinate || centeredOnUser.current || userMovedMap.current) return;
    centeredOnUser.current = true;
    const nextRegion = { ...region, ...position.userCoordinate };
    setRegion(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, 350);
  }, [position.userCoordinate, region]);

  useFocusEffect(useCallback(() => {
    activityRefreshRef.current();
    placeRefreshRef.current();
    sheetRef.current?.snapToIndex(SHEET_PEEK_INDEX);
    sheetIndex.current = SHEET_PEEK_INDEX;
    setViewMode('map');
    // Query refresh callbacks intentionally follow the current shared region.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  const query = searchQuery.trim().toLocaleLowerCase();
  const filteredActivities = useMemo(() => activitiesQuery.feedActivities.filter((activity) => {
    if (selectedActivityCategory !== 'all' && activity.category !== selectedActivityCategory) return false;
    return !query || activity.title.toLocaleLowerCase().includes(query);
  }), [activitiesQuery.feedActivities, query, selectedActivityCategory]);
  const filteredPlaces = useMemo(() => placesQuery.places.filter((place) => {
    if (!query) return true;
    return [place.name, place.neighborhood, place.shortDescription]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLocaleLowerCase().includes(query));
  }), [placesQuery.places, query]);

  const mergedItems = useMemo(() => mergeDiscoveryItems(filteredActivities, filteredPlaces, {
    latitude: region.latitude,
    longitude: region.longitude,
  }), [filteredActivities, filteredPlaces, region.latitude, region.longitude]);
  const visibleItems = useMemo(() => filterDiscoveryItems(mergedItems, contentFilter), [contentFilter, mergedItems]);
  const visibleActivities = useMemo(() => visibleItems.flatMap((item) => item.type === 'activity' ? [item.data] : []), [visibleItems]);
  const visiblePlaces = useMemo(() => visibleItems.flatMap((item) => item.type === 'place' ? [item.data] : []), [visibleItems]);
  const placeMapItems = useMemo(() => clusterPlacesForRegion(visiblePlaces, region), [region, visiblePlaces]);

  const focusItem = useCallback((item: DiscoveryItem) => {
    setSelectedItem({ type: item.type, id: item.id });
    mapRef.current?.animateToRegion({
      latitude: item.data.latitude,
      longitude: item.data.longitude,
      latitudeDelta: 0.018,
      longitudeDelta: 0.018,
    }, 350);
    if (sheetIndex.current === SHEET_PEEK_INDEX) sheetRef.current?.snapToIndex(SHEET_HALF_INDEX);
    const index = visibleItems.findIndex((candidate) => discoveryItemKey(candidate) === discoveryItemKey(item));
    if (index >= 0) listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.2 });
  }, [visibleItems]);

  const openItem = useCallback((item: DiscoveryItem) => {
    focusItem(item);
    if (item.type === 'activity') onOpenActivity(item.data);
    else onOpenPlace(item.data);
  }, [focusItem, onOpenActivity, onOpenPlace]);

  const changeContentFilter = useCallback((next: DiscoveryContentFilter) => {
    setContentFilter(next);
    setSelectedItem(null);
  }, []);

  const hour = new Date().getHours();
  const greetingPrefix = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';
  const firstName = profile?.displayName?.trim().split(' ')[0];
  const greeting = firstName ? `${greetingPrefix}, ${firstName}` : greetingPrefix;
  const hasCachedContent = visibleItems.length > 0;
  const showSkeleton = !hasCachedContent && (activitiesQuery.isRefreshing || placesQuery.isLoading || position.isResolving);
  const showActivityError = contentFilter !== 'places' && Boolean(activitiesQuery.error);
  const showPlaceError = contentFilter !== 'activities' && Boolean(placesQuery.error);

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        onPanDrag={() => { userMovedMap.current = true; }}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsMyLocationButton={false}
      >
        {visibleActivities.map((activity) => {
          const item: DiscoveryItem = { type: 'activity', id: activity.id, data: activity };
          return <ActivityMapPin key={discoveryItemKey(item)} activity={activity} selected={discoverySelectionEquals(selectedItem, item)} onPress={() => focusItem(item)} />;
        })}
        {placeMapItems.map((mapItem) => mapItem.kind === 'place' ? (() => {
          const item: DiscoveryItem = { type: 'place', id: mapItem.place.id, data: mapItem.place };
          return <PlaceMapPin key={discoveryItemKey(item)} place={mapItem.place} selected={discoverySelectionEquals(selectedItem, item)} onPress={() => focusItem(item)} />;
        })() : (
          <PlaceClusterMarker
            key={`place-cluster:${mapItem.id}`}
            latitude={mapItem.latitude}
            longitude={mapItem.longitude}
            count={mapItem.places.length}
            selected={mapItem.places.some((place) => selectedItem?.type === 'place' && place.id === selectedItem.id)}
            onPress={() => mapRef.current?.animateToRegion({
              latitude: mapItem.latitude,
              longitude: mapItem.longitude,
              latitudeDelta: Math.max(region.latitudeDelta / 2, 0.004),
              longitudeDelta: Math.max(region.longitudeDelta / 2, 0.004),
            }, 300)}
          />
        ))}
      </MapView>

      <SafeAreaView edges={['top']} style={styles.headerOverlay} pointerEvents="box-none">
        <View style={styles.contentFilter} accessibilityRole="tablist">
          {CONTENT_FILTERS.map((item) => (
            <Pressable
              key={item.key}
              style={[styles.contentFilterOption, contentFilter === item.key && styles.contentFilterSelected]}
              onPress={() => changeContentFilter(item.key)}
              accessibilityRole="tab"
              accessibilityLabel={`Show ${item.label.toLocaleLowerCase()}`}
              accessibilityState={{ selected: contentFilter === item.key }}
            >
              <Text style={[styles.contentFilterText, contentFilter === item.key && styles.contentFilterTextSelected]}>{item.label}</Text>
            </Pressable>
          ))}
        </View>

        {searchOpen ? (
          <View style={styles.searchRow}>
            <MagnifyingGlass size={iconDefaults.size.inline} color={theme.text.muted} weight={iconDefaults.weight} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search activities and places"
              placeholderTextColor={theme.text.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
              returnKeyType="search"
              textAlign="left"
            />
            <Pressable onPress={() => { setSearchOpen(false); setSearchQuery(''); }} accessibilityLabel="Close search" hitSlop={8}>
              <X size={16} color={theme.text.secondary} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.headerRow}>
            <Text style={styles.greeting}>{greeting}</Text>
            <View style={styles.headerActions}>
              <View style={styles.viewToggle}>
                <Pressable style={[styles.viewToggleOption, viewMode === 'map' && styles.viewToggleSelected]} onPress={() => { setViewMode('map'); sheetRef.current?.snapToIndex(SHEET_PEEK_INDEX); }} accessibilityLabel="Map view" accessibilityState={{ selected: viewMode === 'map' }}>
                  <MapTrifold size={16} color={viewMode === 'map' ? theme.text.inverse : theme.text.secondary} />
                </Pressable>
                <Pressable style={[styles.viewToggleOption, viewMode === 'list' && styles.viewToggleSelected]} onPress={() => { setViewMode('list'); sheetRef.current?.snapToIndex(SHEET_FULL_INDEX); }} accessibilityLabel="List view" accessibilityState={{ selected: viewMode === 'list' }}>
                  <ListBullets size={16} color={viewMode === 'list' ? theme.text.inverse : theme.text.secondary} />
                </Pressable>
              </View>
              <Pressable style={styles.iconButton} onPress={() => setSearchOpen(true)} accessibilityLabel="Search activities and places">
                <MagnifyingGlass size={20} color={theme.text.primary} />
              </Pressable>
            </View>
          </View>
        )}

        {contentFilter !== 'places' ? <FilterRow label={contentFilter === 'all' ? 'Activity filters' : undefined} items={ACTIVITY_CATEGORIES} selected={selectedActivityCategory} onSelect={setSelectedActivityCategory} /> : null}
        {contentFilter !== 'activities' ? <>
          <FilterRow label={contentFilter === 'all' ? 'Place filters' : undefined} items={PLACE_CATEGORIES} selected={selectedPlaceCategory} onSelect={setSelectedPlaceCategory} />
          <FlatList horizontal showsHorizontalScrollIndicator={false} data={PLACE_QUICK_FILTERS} keyExtractor={(item) => item.key} contentContainerStyle={styles.chipRowCompact} renderItem={({ item }) => <CategoryChip label={item.label} selected={placeQuickFilters.has(item.key)} onPress={() => setPlaceQuickFilters((current) => togglePlaceQuickFilter(current, item.key))} />} />
        </> : null}
      </SafeAreaView>

      <Pressable style={styles.fab} onPress={onHostActivity} accessibilityLabel="Host an activity">
        <Plus size={24} color={theme.text.inverse} weight="bold" />
      </Pressable>

      <BottomSheet ref={sheetRef} index={SHEET_PEEK_INDEX} snapPoints={SNAP_POINTS} enableDynamicSizing={false} onChange={(index) => { sheetIndex.current = index; setViewMode(index >= SHEET_FULL_INDEX ? 'list' : 'map'); }} backgroundStyle={styles.sheetBackground} handleIndicatorStyle={styles.sheetHandle}>
        <BottomSheetView style={styles.sheetHeader}>
          <Text style={styles.sheetTitle}>{showSkeleton ? 'Finding nearby options…' : discoveryCountLabel(contentFilter, visibleItems.length)}</Text>
          {!showSkeleton && visibleItems.length > 0 ? <Text style={styles.sheetSubtitle}>Swipe up to explore</Text> : null}
        </BottomSheetView>
        {showActivityError ? <QueryErrorBanner label="Activities couldn't refresh" onRetry={activitiesQuery.refresh} /> : null}
        {showPlaceError ? <QueryErrorBanner label="Places couldn't refresh" onRetry={placesQuery.refresh} /> : null}
        {showSkeleton ? (
          <BottomSheetView style={styles.listContent}>{[0, 1, 2].map((index) => <View key={index} style={styles.feedItem}><SkeletonCard /></View>)}</BottomSheetView>
        ) : (
          <BottomSheetFlatList
            ref={listRef}
            data={visibleItems}
            keyExtractor={discoveryItemKey}
            renderItem={({ item }: { item: DiscoveryItem }) => <View style={styles.feedItem}>{item.type === 'activity'
              ? <ActivityCard activity={item.data} variant="feed" onPress={() => openItem(item)} highlighted={discoverySelectionEquals(selectedItem, item)} />
              : <PlaceCard place={item.data} onPress={() => openItem(item)} highlighted={discoverySelectionEquals(selectedItem, item)} />}
            </View>}
            contentContainerStyle={styles.listContent}
            initialNumToRender={6}
            maxToRenderPerBatch={8}
            windowSize={7}
            removeClippedSubviews
            onEndReached={contentFilter !== 'activities' && placesQuery.hasMore ? placesQuery.loadMore : undefined}
            onEndReachedThreshold={0.5}
            ListEmptyComponent={<DiscoveryEmptyState filter={contentFilter} locationDenied={position.locationDenied} onHostActivity={onHostActivity} />}
            onScrollToIndexFailed={({ index }) => setTimeout(() => listRef.current?.scrollToIndex({ index, animated: true }), 100)}
          />
        )}
      </BottomSheet>
    </View>
  );
}

function FilterRow<TKey extends string>({ label, items, selected, onSelect }: { label?: string; items: Array<{ key: TKey; label: string }>; selected: TKey; onSelect: (key: TKey) => void }) {
  return <View>{label ? <Text style={styles.filterLabel}>{label}</Text> : null}<FlatList horizontal showsHorizontalScrollIndicator={false} data={items} keyExtractor={(item) => item.key} contentContainerStyle={styles.chipRow} renderItem={({ item }) => <CategoryChip label={item.label} selected={selected === item.key} onPress={() => onSelect(item.key)} />} /></View>;
}

function QueryErrorBanner({ label, onRetry }: { label: string; onRetry: () => void }) {
  return <View style={styles.errorBanner}><WarningCircle size={17} color={theme.semantic.warning} weight="fill" /><Text style={styles.errorBannerText}>{label}</Text><Pressable onPress={onRetry} accessibilityRole="button" accessibilityLabel={`${label}. Try again`}><Text style={styles.retryText}>Try again</Text></Pressable></View>;
}

function DiscoveryEmptyState({ filter, locationDenied, onHostActivity }: { filter: DiscoveryContentFilter; locationDenied: boolean; onHostActivity: () => void }) {
  const copy = filter === 'activities'
    ? 'No activities match these filters.'
    : filter === 'places'
      ? 'No places match these filters.'
      : 'No activities or places found in this area.';
  return <View style={styles.emptyState}><Text style={styles.emptyTitle}>{copy}</Text><Text style={styles.emptyBody}>{locationDenied ? 'Location access is off, so this area may not be near you.' : 'Try moving the map, changing a filter, or searching nearby.'}</Text>{filter !== 'places' ? <Pressable style={styles.emptyAction} onPress={onHostActivity}><Text style={styles.emptyActionText}>Host an activity</Text></Pressable> : null}</View>;
}

function discoveryCountLabel(filter: DiscoveryContentFilter, count: number): string {
  if (filter === 'activities') return `${count} ${count === 1 ? 'activity' : 'activities'} nearby`;
  if (filter === 'places') return `${count} ${count === 1 ? 'place' : 'places'} in this area`;
  return `${count} nearby`;
}

function togglePlaceQuickFilter(current: Set<PlaceQuickFilter>, key: PlaceQuickFilter): Set<PlaceQuickFilter> {
  const next = new Set(current);
  const exclusive: PlaceQuickFilter[] = key === 'indoor' ? ['outdoor'] : key === 'outdoor' ? ['indoor'] : key === 'free' ? ['paid'] : key === 'paid' ? ['free'] : ['babies', 'toddlers', 'kids'].includes(key) ? (['babies', 'toddlers', 'kids'] as PlaceQuickFilter[]).filter((candidate) => candidate !== key) : [];
  exclusive.forEach((candidate) => next.delete(candidate));
  if (next.has(key)) next.delete(key); else next.add(key);
  return next;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background.app },
  headerOverlay: { position: 'absolute', top: 0, left: 0, right: 0 },
  contentFilter: { alignSelf: 'center', flexDirection: 'row', padding: 3, borderRadius: radius.pill, backgroundColor: theme.background.surface, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  contentFilterOption: { minWidth: 84, minHeight: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  contentFilterSelected: { backgroundColor: theme.brand.primary },
  contentFilterText: { ...typography.subhead, color: theme.text.secondary, fontWeight: '600' },
  contentFilterTextSelected: { color: theme.text.inverse },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  greeting: { ...typography.bodyMedium, color: theme.text.primary },
  headerActions: { flexDirection: 'row', gap: spacing.sm },
  viewToggle: { flexDirection: 'row', padding: 2, borderRadius: radius.pill, backgroundColor: theme.background.surface },
  viewToggleOption: { width: 38, height: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  viewToggleSelected: { backgroundColor: theme.brand.primary },
  iconButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: theme.background.surface, alignItems: 'center', justifyContent: 'center' },
  searchRow: { marginHorizontal: spacing.lg, marginTop: spacing.sm, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: theme.background.surface },
  searchInput: { flex: 1, ...typography.body, color: theme.text.primary, direction: 'ltr' },
  filterLabel: { ...typography.caption, color: theme.text.secondary, fontWeight: '700', paddingHorizontal: spacing.lg, marginTop: spacing.xs },
  chipRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  chipRowCompact: { paddingHorizontal: spacing.lg, paddingTop: 2 },
  fab: { position: 'absolute', right: spacing.lg, bottom: '24%', width: 54, height: 54, borderRadius: 27, backgroundColor: theme.brand.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 5, elevation: 5 },
  sheetBackground: { backgroundColor: theme.background.app },
  sheetHandle: { backgroundColor: theme.border.strong },
  sheetHeader: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
  sheetTitle: { ...typography.headline, color: theme.text.primary },
  sheetSubtitle: { ...typography.footnote, color: theme.text.secondary, marginTop: 2 },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: 120 },
  feedItem: { width: '100%' },
  errorBanner: { marginHorizontal: spacing.lg, marginBottom: spacing.xs, minHeight: 40, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.md, backgroundColor: theme.semantic.warningTint },
  errorBannerText: { flex: 1, ...typography.footnote, color: theme.text.primary },
  retryText: { ...typography.footnote, color: theme.brand.primary, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.xl },
  emptyTitle: { ...typography.headline, color: theme.text.primary, textAlign: 'center' },
  emptyBody: { ...typography.body, color: theme.text.secondary, textAlign: 'center', marginTop: spacing.xs },
  emptyAction: { minHeight: 44, justifyContent: 'center', marginTop: spacing.md },
  emptyActionText: { ...typography.subhead, color: theme.brand.primary, fontWeight: '700' },
});
