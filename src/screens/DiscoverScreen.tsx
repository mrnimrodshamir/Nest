import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useIsFocused } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { PROVIDER_DEFAULT, type Region } from 'react-native-maps';
import BottomSheet, { BottomSheetFlatList } from '@gorhom/bottom-sheet';
import {
  MagnifyingGlass,
  Funnel,
  ArrowsDownUp,
  Check,
  Plus,
  WarningCircle,
  X,
} from 'phosphor-react-native';
import { ActivityCard } from '@/components/ActivityCard';
import { ActivityMapPin } from '@/components/ActivityMapPin';
import { EventCard } from '@/components/EventCard';
import { EventMapPin } from '@/components/EventMapPin';
import { EventVenueMarker } from '@/components/EventVenueMarker';
import { VenueEventsSheet } from '@/components/VenueEventsSheet';
import { CategoryChip } from '@/components/CategoryChip';
import { PlaceCard } from '@/components/PlaceCard';
import { PlaceClusterMarker } from '@/components/PlaceClusterMarker';
import { PlaceMapPin } from '@/components/PlaceMapPin';
import { SkeletonCard } from '@/components/SkeletonCard';
import { FALLBACK_LOCATION } from '@/constants/location';
import { useDiscoveryPosition } from '@/hooks/useDiscoveryPosition';
import { useDiscoveryEvents } from '@/hooks/useDiscoveryEvents';
import { useFamilyFriendlyPlaces } from '@/hooks/useFamilyFriendlyPlaces';
import { useNearbyActivities } from '@/hooks/useNearbyActivities';
import { radius, spacing, theme, typography, iconDefaults } from '@/theme';
import type { Activity, ActivityCategory } from '@/types/activity';
import type { DiscoveryContentKey, DiscoveryContentSelection, DiscoveryItem, DiscoverySelection, DiscoverySort } from '@/types/discovery';
import type { EventCategory, EventDetails } from '@/types/event';
import type { FamilyFriendlyPlace, PlaceCategory, PlaceFilters } from '@/types/familyFriendlyPlace';
import { clusterPlacesForRegion } from '@/utils/placeClustering';
import { groupEventsByVenue, type EventVenueMapItem } from '@/utils/eventVenueGrouping';
import { DISCOVERY_DATE_FILTERS, type DiscoveryDateFilterKey } from '@/utils/discoveryDateFilter';
import { regionToPlaceViewport } from '@/utils/placeViewport';
import { distanceMeters } from '@/utils/placeViewport';
import { ALL_DISCOVERY_CONTENT, discoveryEmptyCopyKey, selectedContentKeys, toggleDiscoveryContent, visibleDiscoveryFailures } from '@/utils/discoveryPresentation';
import { useI18n, textAlignForContent, type TranslationKey } from '@/i18n';
import { applyContentSelectionChange, discoveryMapPointerEvents, handleDiscoveryItemIntent, nextDiscoveryMapGeneration, shouldRefreshDiscoveryMapForAppState } from '@/utils/discoveryScreenState';
import { track } from '@/lib/analytics';
import { resolveCityForCoordinate } from '@/config/cities';
import { displayedEventContent } from '../../supabase/functions/_shared/eventTranslation';
import {
  discoveryItemKey,
  discoveryCoordinateInViewport,
  discoverySelectionEquals,
  filterDiscoveryItems,
  mergeDiscoveryItems,
  sortDiscoveryItems,
} from '@/utils/unifiedDiscovery';

const ACTIVITY_CATEGORIES: Array<{ key: ActivityCategory | 'all'; labelKey: TranslationKey }> = [
  { key: 'all', labelKey: 'filters.allActivities' },
  { key: 'stroller_walk', labelKey: 'activity.category.stroller_walk' },
  { key: 'coffee_meetup', labelKey: 'activity.category.coffee_meetup' },
  { key: 'baby_playtime', labelKey: 'activity.category.baby_playtime' },
  { key: 'picnic', labelKey: 'activity.category.picnic' },
  { key: 'fitness', labelKey: 'activity.category.fitness' },
  { key: 'yoga', labelKey: 'activity.category.yoga' },
  { key: 'workshop', labelKey: 'activity.category.workshop' },
];

const PLACE_CATEGORIES: Array<{ key: PlaceCategory | 'all'; labelKey: TranslationKey }> = [
  { key: 'all', labelKey: 'filters.allPlaces' },
  { key: 'playground', labelKey: 'place.category.playground' },
  { key: 'park', labelKey: 'place.category.park' },
  { key: 'indoor_playground', labelKey: 'place.category.indoor_playground' },
  { key: 'museum', labelKey: 'place.category.museum' },
  { key: 'beach', labelKey: 'place.category.beach' },
  { key: 'pool', labelKey: 'place.category.pool' },
];

// Both tables carry translation KEYS, resolved at render time. Holding
// resolved strings in a module constant would freeze them at the language
// active on first import and never update when the user switches.
const CONTENT_TYPES: Array<{ key: DiscoveryContentKey; labelKey: TranslationKey }> = [
  { key: 'activities', labelKey: 'discovery.activities' },
  { key: 'places', labelKey: 'discovery.places' },
  { key: 'events', labelKey: 'discovery.events' },
];

const SORT_OPTIONS: Array<{ key: DiscoverySort; labelKey: TranslationKey }> = [
  { key: 'default', labelKey: 'sort.default' },
  { key: 'distance', labelKey: 'sort.distance' },
  { key: 'soonest', labelKey: 'sort.soonest' },
  { key: 'alphabetical', labelKey: 'sort.alphabetical' },
];

// Order matches the conceptual relevance ladder from the mission brief:
// today → tomorrow → this week → this weekend → next 7 days → rest of 30
// days (the default) → explicitly everything, which is the only path back
// to far-future Events the 30-day default excludes from normal Discovery.
const DATE_FILTER_OPTIONS: Array<{ key: DiscoveryDateFilterKey; labelKey: TranslationKey }> = DISCOVERY_DATE_FILTERS.map((key) => ({
  key, labelKey: `discovery.dateFilter.${key}` as TranslationKey,
}));

const EVENT_CATEGORIES: Array<{ key: EventCategory | 'all'; labelKey: TranslationKey }> = [
  { key: 'all', labelKey: 'filters.allEvents' },
  { key: 'story_time', labelKey: 'event.category.story_time' },
  { key: 'workshop', labelKey: 'event.category.workshop' },
  { key: 'performance', labelKey: 'event.category.performance' },
  { key: 'festival', labelKey: 'event.category.festival' },
  { key: 'museum', labelKey: 'event.category.museum' },
  { key: 'library', labelKey: 'event.category.library' },
  { key: 'park', labelKey: 'event.category.park' },
];

type PlaceQuickFilter =
  | 'babies' | 'toddlers' | 'kids'
  | 'indoor' | 'outdoor' | 'free' | 'paid'
  | 'changingTable' | 'toilets' | 'highChairs' | 'shade' | 'waterFountain' | 'accessible';

const PLACE_QUICK_FILTERS: Array<{ key: PlaceQuickFilter; labelKey: TranslationKey }> = [
  { key: 'babies', labelKey: 'filters.babies' }, { key: 'toddlers', labelKey: 'filters.toddlers' }, { key: 'kids', labelKey: 'filters.kids' },
  { key: 'indoor', labelKey: 'place.fact.indoor' }, { key: 'outdoor', labelKey: 'place.fact.outdoor' },
  { key: 'free', labelKey: 'place.fact.free' }, { key: 'paid', labelKey: 'place.fact.paid' },
  { key: 'changingTable', labelKey: 'place.fact.changingTable' }, { key: 'toilets', labelKey: 'place.fact.toilets' },
  { key: 'highChairs', labelKey: 'place.fact.highChairs' }, { key: 'shade', labelKey: 'place.fact.shade' },
  { key: 'waterFountain', labelKey: 'place.fact.water' }, { key: 'accessible', labelKey: 'place.fact.accessible' },
];

const SNAP_POINTS = ['22%', '50%', '92%'];
const SHEET_PEEK_INDEX = 0;
const MARKER_OPEN_DELAY_MS = 120;

interface DiscoverScreenProps {
  onOpenActivity: (activity: Activity) => void;
  onOpenPlace: (place: FamilyFriendlyPlace) => void;
  onOpenEvent: (event: EventDetails) => void;
  onHostActivity: () => void;
  mockActivities?: Activity[];
  mockPlaces?: FamilyFriendlyPlace[];
  mockEvents?: EventDetails[];
}

export function DiscoverScreen({ onOpenActivity, onOpenPlace, onOpenEvent, onHostActivity, mockActivities, mockPlaces, mockEvents }: DiscoverScreenProps) {
  const isFocused = useIsFocused();
  const [mapGeneration, setMapGeneration] = useState(0);
  const previewMode = mockActivities !== undefined || mockPlaces !== undefined || mockEvents !== undefined;
  const initialCoordinate = mockActivities?.[0] ?? mockPlaces?.[0] ?? mockEvents?.[0]?.location ?? FALLBACK_LOCATION;
  const [region, setRegion] = useState<Region>({
    latitude: initialCoordinate.latitude,
    longitude: initialCoordinate.longitude,
    latitudeDelta: 0.04,
    longitudeDelta: 0.04,
  });
  const [contentSelection, setContentSelection] = useState<DiscoveryContentSelection>(() => ({ ...ALL_DISCOVERY_CONTENT }));
  const [selectedItem, setSelectedItem] = useState<DiscoverySelection>(null);
  const [selectedActivityCategory, setSelectedActivityCategory] = useState<ActivityCategory | 'all'>('all');
  const [selectedPlaceCategory, setSelectedPlaceCategory] = useState<PlaceCategory | 'all'>('all');
  const [selectedEventCategory, setSelectedEventCategory] = useState<EventCategory | 'all'>('all');
  const [placeQuickFilters, setPlaceQuickFilters] = useState<Set<PlaceQuickFilter>>(() => new Set());
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [sort, setSort] = useState<DiscoverySort>('default');
  const [dateFilter, setDateFilter] = useState<DiscoveryDateFilterKey>('next30');
  const [openVenueGroup, setOpenVenueGroup] = useState<Extract<EventVenueMapItem, { kind: 'venue' }> | null>(null);
  const [filterNotice, setFilterNotice] = useState<string | null>(null);

  const { t, locale } = useI18n();
  // Follows the TYPED text, not the UI language, so an English query in a
  // Hebrew UI is not reversed (and vice versa). Empty input uses the locale.
  const searchDirection = textAlignForContent(searchQuery, locale);

  const mapRef = useRef<MapView>(null);
  const sheetRef = useRef<BottomSheet>(null);
  const listRef = useRef<React.ElementRef<typeof BottomSheetFlatList>>(null);
  const userMovedMap = useRef(false);
  const centeredOnUser = useRef(false);
  const hasFocusedOnce = useRef(false);
  const mapBlurredSinceLastFocus = useRef(false);
  const markerOpenTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    if (isFocused) {
      setMapGeneration((current) => nextDiscoveryMapGeneration(current, mapBlurredSinceLastFocus.current));
      mapBlurredSinceLastFocus.current = false;
      return undefined;
    }
    mapBlurredSinceLastFocus.current = true;
    return undefined;
  }, [isFocused]);

  useEffect(() => () => {
    if (markerOpenTimer.current) clearTimeout(markerOpenTimer.current);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (isFocused && shouldRefreshDiscoveryMapForAppState(appState.current, nextState)) {
        setMapGeneration((current) => current + 1);
      }
      appState.current = nextState;
    });
    return () => subscription.remove();
  }, [isFocused]);

  useEffect(() => {
    track('discovery_opened', { discovery_mode: 'mixed', city: resolveCityForCoordinate(initialCoordinate.latitude, initialCoordinate.longitude) ?? 'unknown' });
  }, []);

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
  const eventsQuery = useDiscoveryEvents({ viewport, mockEvents, dateFilter });
  const activityRefreshRef = useRef(activitiesQuery.refresh);
  const placeRefreshRef = useRef(placesQuery.refresh);
  const eventRefreshRef = useRef(eventsQuery.refresh);
  activityRefreshRef.current = activitiesQuery.refresh;
  placeRefreshRef.current = placesQuery.refresh;
  eventRefreshRef.current = eventsQuery.refresh;

  useEffect(() => {
    if (!position.userCoordinate || centeredOnUser.current || userMovedMap.current) return;
    centeredOnUser.current = true;
    const nextRegion = { ...region, ...position.userCoordinate };
    setRegion(nextRegion);
    mapRef.current?.animateToRegion(nextRegion, 350);
  }, [position.userCoordinate, region]);

  useFocusEffect(useCallback(() => {
    if (hasFocusedOnce.current) {
      activityRefreshRef.current();
      placeRefreshRef.current();
      eventRefreshRef.current();
    } else {
      hasFocusedOnce.current = true;
    }
    sheetRef.current?.snapToIndex(SHEET_PEEK_INDEX);
    // Query refresh callbacks intentionally follow the current shared region.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []));

  const query = searchQuery.trim().toLocaleLowerCase();
  const filteredActivities = useMemo(() => activitiesQuery.feedActivities.flatMap((activity) => {
    if (!discoveryCoordinateInViewport(activity, viewport)) return [];
    if (selectedActivityCategory !== 'all' && activity.category !== selectedActivityCategory) return [];
    if (query && !activity.title.toLocaleLowerCase().includes(query)) return [];
    return [{
      ...activity,
      distanceKm: position.userCoordinate ? distanceMeters(position.userCoordinate, activity) / 1_000 : activity.distanceKm,
    }];
  }), [activitiesQuery.feedActivities, position.userCoordinate, query, selectedActivityCategory, viewport]);
  const filteredPlaces = useMemo(() => placesQuery.places.filter((place) => {
    if (!query) return true;
    return [place.name, place.neighborhood, place.shortDescription]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLocaleLowerCase().includes(query));
  }), [placesQuery.places, query]);
  const filteredEvents = useMemo(() => eventsQuery.events.filter((event) => {
    if (!discoveryCoordinateInViewport(event.location, viewport)) return false;
    if (selectedEventCategory !== 'all' && event.category !== selectedEventCategory) return false;
    if (!query) return true;
    const content = displayedEventContent(event);
    return [content.title, content.description, event.location.name, event.location.formattedAddress]
      .filter((value): value is string => Boolean(value))
      .some((value) => value.toLocaleLowerCase().includes(query));
  }), [eventsQuery.events, query, selectedEventCategory, viewport]);

  const mergedItems = useMemo(() => mergeDiscoveryItems(filteredActivities, filteredPlaces, filteredEvents, {
    latitude: region.latitude,
    longitude: region.longitude,
  }), [filteredActivities, filteredEvents, filteredPlaces, region.latitude, region.longitude]);
  const visibleItems = useMemo(() => filterDiscoveryItems(mergedItems, contentSelection), [contentSelection, mergedItems]);
  const listItems = useMemo(() => sortDiscoveryItems(visibleItems, sort, position.userCoordinate ?? region), [position.userCoordinate, region, sort, visibleItems]);
  const visibleActivities = useMemo(() => visibleItems.flatMap((item) => item.type === 'activity' ? [item.data] : []), [visibleItems]);
  const visiblePlaces = useMemo(() => visibleItems.flatMap((item) => item.type === 'place' ? [item.data] : []), [visibleItems]);
  const visibleEvents = useMemo(() => visibleItems.flatMap((item) => item.type === 'event' ? [item.data] : []), [visibleItems]);
  const placeMapItems = useMemo(() => clusterPlacesForRegion(visiblePlaces, region), [region, visiblePlaces]);
  // Venue grouping, not geographic clustering: the same real venue stays one
  // marker at any zoom level (see src/utils/eventVenueGrouping.ts), unlike
  // placeMapItems above which merges DIFFERENT places when they visually
  // collide. Built from visibleEvents — the same already-filtered set the
  // list uses — so a marker's count and the list's result count can never
  // disagree, and narrowing a filter narrows both together.
  const venueMapItems = useMemo(() => groupEventsByVenue(visibleEvents), [visibleEvents]);

  const openItem = useCallback((item: DiscoveryItem) => {
    handleDiscoveryItemIntent(item, 'open', {
      preview: (previewed) => setSelectedItem({ type: previewed.type, id: previewed.id }),
      trackOpen: (opened) => track('discovery_item_opened', { content_type: opened.type, content_id: opened.id, discovery_mode: 'mixed' }),
      openActivity: (opened) => onOpenActivity(opened.data),
      openPlace: (opened) => onOpenPlace(opened.data),
      openEvent: (opened) => onOpenEvent(opened.data),
    });
  }, [onOpenActivity, onOpenEvent, onOpenPlace]);

  const openMarkerItem = useCallback((item: DiscoveryItem) => {
    // Do not issue native preview commands from a MapKit marker callback.
    // Make the target visible immediately, then open it after the native press
    // dispatch has left the annotation view.
    setSelectedItem({ type: item.type, id: item.id });
    if (markerOpenTimer.current) clearTimeout(markerOpenTimer.current);
    markerOpenTimer.current = setTimeout(() => {
      markerOpenTimer.current = null;
      openItem(item);
    }, MARKER_OPEN_DELAY_MS);
  }, [openItem]);

  /** A venue marker holding multiple Events never arbitrarily opens one of
   *  them — it opens the "{count} activities here" sheet instead, and the
   *  user picks. */
  const openVenueMarker = useCallback((group: Extract<EventVenueMapItem, { kind: 'venue' }>) => {
    setOpenVenueGroup(group);
    track('venue_marker_opened', { event_count: group.events.length, city: resolveCityForCoordinate(group.latitude, group.longitude) ?? 'unknown' });
  }, []);

  const openVenueEvent = useCallback((event: EventDetails) => {
    track('venue_event_opened', { content_id: event.occurrence.id, event_count: openVenueGroup?.events.length ?? 0 });
    openItem({ type: 'event', id: event.occurrence.id, data: event });
  }, [openItem, openVenueGroup]);

  const changeContentSelection = useCallback((key: DiscoveryContentKey) => {
    // The rules (keep one type selected; drop a now-hidden selected marker)
    // live in a pure module so they can be asserted without mounting the map.
    const next = applyContentSelectionChange({ selection: contentSelection, selectedItem }, key);
    setFilterNotice(next.prevented ? t('filters.keepOneType') : null);
    if (next.prevented) return;
    setContentSelection(next.selection);
    setSelectedItem(next.selectedItem);
    track('discovery_filter_changed', { filter_type: 'content_type', filter_value: key });
    // Deliberately does NOT touch `region` — changing what is shown must never
    // move the camera the user positioned — and issues no refetch: this is a
    // visibility change over data already cached.
  }, [contentSelection, selectedItem, t]);

  /** The sheet's sticky header: the controls, the result count, and any
   *  per-domain error banners.
   *
   *  It is the FlatList's ListHeaderComponent rather than a sibling of the
   *  list, because the sheet renders exactly one content child (see the note
   *  at the BottomSheet below). Opaque background: as a sticky header it sits
   *  over the feed while scrolling and must not let cards show through. */
  const DiscoverySheetHeader = () => (
    <View style={styles.sheetHeader}>
      <View style={styles.toolbarSticky}>
        <ToolbarButton icon={MagnifyingGlass} label={t('discovery.search')} onPress={() => setSearchOpen(true)} />
        <ToolbarButton icon={Funnel} label={activeFilterCount ? t('filters.withCount', { count: activeFilterCount }) : t('discovery.filters')} onPress={() => setFiltersOpen(true)} active={activeFilterCount > 0} />
        <ToolbarButton icon={ArrowsDownUp} label={t('discovery.sort')} onPress={() => setSortOpen(true)} active={sort !== 'default'} />
      </View>
      <Text style={styles.sheetTitle}>{showSkeleton ? t('discovery.finding') : t(discoveryCountKey(contentSelection, visibleItems.length), { count: visibleItems.length })}</Text>
      {/* Only shown for Events under the default horizon — the one Discovery
          actually narrows by date. Never shown once the user picked an
          explicit date filter, since that IS their intent, not a default to
          disclose. */}
      {!showSkeleton && contentSelection.events && dateFilter === 'next30' ? <Text style={styles.sheetSubtitle}>{t('discovery.horizonDefault')}</Text> : !showSkeleton && visibleItems.length > 0 ? <Text style={styles.sheetSubtitle}>{t('discovery.swipeUp')}</Text> : null}
      {/* One banner per FAILED domain only — the domains that loaded stay
          listed below rather than being replaced by a full-screen error. */}
      {showActivityError ? <QueryErrorBanner label={t('discovery.error.activities')} onRetry={activitiesQuery.refresh} /> : null}
      {showPlaceError ? <QueryErrorBanner label={t('discovery.error.places')} onRetry={placesQuery.refresh} /> : null}
      {showEventError ? <QueryErrorBanner label={t('discovery.error.events')} onRetry={eventsQuery.refresh} /> : null}
    </View>
  );

  /** Restores every filter to its default. Content selection returns to all
   *  three, which is always valid, so the keep-one-type rule cannot trip. */
  const resetAllFilters = useCallback(() => {
    setContentSelection({ ...ALL_DISCOVERY_CONTENT });
    setSelectedActivityCategory('all');
    setSelectedPlaceCategory('all');
    setSelectedEventCategory('all');
    setDateFilter('next30');
    setPlaceQuickFilters(new Set());
    setFilterNotice(null);
  }, []);

  const hasCachedContent = visibleItems.length > 0;
  const showSkeleton = !hasCachedContent && (activitiesQuery.isRefreshing || placesQuery.isLoading || eventsQuery.isLoading || position.isResolving);
  const visibleFailures = visibleDiscoveryFailures(contentSelection, activitiesQuery.error, placesQuery.error, eventsQuery.error);
  const activeFilterCount = (selectedContentKeys(contentSelection).length === 3 ? 0 : 1)
    + Number(selectedActivityCategory !== 'all') + Number(selectedPlaceCategory !== 'all')
    + Number(selectedEventCategory !== 'all') + Number(dateFilter !== 'next30') + placeQuickFilters.size;
  const showActivityError = visibleFailures.includes('activity');
  const showPlaceError = visibleFailures.includes('place');
  const showEventError = visibleFailures.includes('event');

  return (
    <View style={styles.container}>
      {/* Never tear MapKit down during the navigation transition. Opening a
          marker performs no map/list/sheet native command; on refocus the key
          changes and React creates a fresh native responder before the parent
          can interact. The ordinary wrapper suppresses touches only while the
          screen is covered. */}
      <View style={StyleSheet.absoluteFill} pointerEvents={discoveryMapPointerEvents(isFocused)}>
      <MapView
        key={`discovery-map-${mapGeneration}`}
        ref={mapRef}
        provider={PROVIDER_DEFAULT}
        style={StyleSheet.absoluteFill}
        initialRegion={region}
        onPanDrag={() => { userMovedMap.current = true; }}
        onRegionChangeComplete={setRegion}
        showsUserLocation
        showsMyLocationButton={false}
        scrollEnabled
        zoomEnabled
        rotateEnabled
        pitchEnabled
      >
        {visibleActivities.map((activity) => {
          const item: DiscoveryItem = { type: 'activity', id: activity.id, data: activity };
          return <ActivityMapPin key={discoveryItemKey(item)} activity={activity} selected={discoverySelectionEquals(selectedItem, item)} onPress={() => openMarkerItem(item)} />;
        })}
        {placeMapItems.map((mapItem) => mapItem.kind === 'place' ? (() => {
          const item: DiscoveryItem = { type: 'place', id: mapItem.place.id, data: mapItem.place };
          return <PlaceMapPin key={discoveryItemKey(item)} place={mapItem.place} selected={discoverySelectionEquals(selectedItem, item)} onPress={() => openMarkerItem(item)} />;
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
        {venueMapItems.map((mapItem) => mapItem.kind === 'single' ? (() => {
          const item: DiscoveryItem = { type: 'event', id: mapItem.event.occurrence.id, data: mapItem.event };
          return <EventMapPin key={discoveryItemKey(item)} event={mapItem.event} selected={discoverySelectionEquals(selectedItem, item)} onPress={() => openMarkerItem(item)} />;
        })() : (
          <EventVenueMarker
            key={`event-venue:${mapItem.key}`}
            latitude={mapItem.latitude}
            longitude={mapItem.longitude}
            count={mapItem.events.length}
            selected={mapItem.events.some((event) => selectedItem?.type === 'event' && event.occurrence.id === selectedItem.id)}
            onPress={() => openVenueMarker(mapItem)}
          />
        ))}
      </MapView>
      </View>

      <SafeAreaView edges={['top']} style={styles.headerOverlay} pointerEvents="box-none">
        {searchOpen ? (
          <View style={styles.searchRow}>
            <MagnifyingGlass size={iconDefaults.size.inline} color={theme.text.muted} weight={iconDefaults.weight} />
            <TextInput
              style={[styles.searchInput, searchDirection]}
              placeholder={t('discovery.searchPlaceholder')}
              placeholderTextColor={theme.text.muted}
              value={searchQuery}
              onChangeText={setSearchQuery}
              onSubmitEditing={() => {
                if (searchQuery.trim().length >= 2) track('discovery_search_used', { query_length: searchQuery.trim().length });
              }}
              autoFocus
              returnKeyType="search"
              // Direction follows what has been TYPED, not the UI language: a
              // Hebrew UI must not reverse an English venue name, and an
              // English UI must not left-align a Hebrew query. Empty input
              // falls back to the locale.
              textAlign={searchDirection.textAlign}
            />
            <Pressable onPress={() => { setSearchOpen(false); setSearchQuery(''); }} accessibilityLabel={t('discovery.closeSearch')} hitSlop={8}>
              <X size={16} color={theme.text.secondary} />
            </Pressable>
          </View>
        ) : null}
        {/* The closed-state toolbar now lives in the sheet header, so this
            overlay carries only the expanded search field. That keeps exactly
            one instance of Search/Filters/Sort and leaves the map clear. */}
      </SafeAreaView>

      {/* Both sheets are conditionally rendered, so dismissing one unmounts it
          and its transient state cannot leak into the next open. */}
      {filtersOpen ? <ModalSheet visible title={t('filters.title')} onDismiss={() => setFiltersOpen(false)}>
        <View style={styles.contentTypeHeader}><Text style={styles.filterLabel}>{t('discovery.contentTypes')}</Text><Pressable onPress={() => { setContentSelection({ ...ALL_DISCOVERY_CONTENT }); setFilterNotice(null); }} accessibilityRole="button" accessibilityLabel={t('discovery.selectAll')}><Text style={styles.selectAll}>{t('discovery.selectAll')}</Text></Pressable></View>
        <View style={styles.contentTypeOptions}>{CONTENT_TYPES.map((item) => <ContentTypeOption key={item.key} label={t(item.labelKey)} selected={contentSelection[item.key]} onPress={() => changeContentSelection(item.key)} />)}</View>
        {filterNotice ? <Text style={styles.filterNotice} accessibilityLiveRegion="polite">{filterNotice}</Text> : null}
        {/* Only the sections for currently-selected content types are shown. */}
        {contentSelection.activities ? <FilterRow label={t('discovery.activities')} items={ACTIVITY_CATEGORIES} selected={selectedActivityCategory} onSelect={(value) => { setSelectedActivityCategory(value); track('discovery_filter_changed', { filter_type: 'activity_category', filter_value: value }); }} /> : null}
        {contentSelection.places ? (
          <>
            <FilterRow label={t('discovery.places')} items={PLACE_CATEGORIES} selected={selectedPlaceCategory} onSelect={(value) => { setSelectedPlaceCategory(value); track('discovery_filter_changed', { filter_type: 'place_category', filter_value: value }); }} />
            <View style={styles.wrapChips}>{PLACE_QUICK_FILTERS.map((item) => <CategoryChip key={item.key} label={t(item.labelKey)} selected={placeQuickFilters.has(item.key)} onPress={() => { setPlaceQuickFilters((current) => togglePlaceQuickFilter(current, item.key)); track('discovery_filter_changed', { filter_type: 'place_quick_filter', filter_value: item.key }); }} />)}</View>
          </>
        ) : null}
        {contentSelection.events ? <FilterRow label={t('discovery.events')} items={EVENT_CATEGORIES} selected={selectedEventCategory} onSelect={(value) => { setSelectedEventCategory(value); track('discovery_filter_changed', { filter_type: 'event_category', filter_value: value }); }} /> : null}
        {contentSelection.events ? <FilterRow label={t('discovery.dateFilter.title')} items={DATE_FILTER_OPTIONS} selected={dateFilter} onSelect={(value) => { setDateFilter(value); track('discovery_filter_changed', { filter_type: 'date_range', filter_value: value }); }} /> : null}
        {activeFilterCount > 0 ? (
          <Pressable style={styles.resetAll} onPress={resetAllFilters} accessibilityRole="button" accessibilityLabel={t('filters.resetAll')}>
            <Text style={styles.resetAllText}>{t('filters.resetAll')}</Text>
          </Pressable>
        ) : null}
      </ModalSheet> : null}

      {sortOpen ? <ModalSheet visible title={t('discovery.sortListTitle')} onDismiss={() => setSortOpen(false)}>
        <View style={styles.sortOptions}>{SORT_OPTIONS.map((item) => <Pressable key={item.key} style={[styles.sortOption, sort === item.key && styles.sortOptionSelected]} onPress={() => { setSort(item.key); setSortOpen(false); track('discovery_sort_changed', { sort: item.key }); }} accessibilityRole="radio" accessibilityState={{ checked: sort === item.key }} accessibilityLabel={t(item.labelKey)}><Text style={[styles.sortOptionText, sort === item.key && styles.sortOptionTextSelected]}>{t(item.labelKey)}</Text></Pressable>)}</View>
        <Text style={styles.sortHint}>{t('discovery.sortHint')}</Text>
      </ModalSheet> : null}

      <VenueEventsSheet group={openVenueGroup} attendeeCounts={eventsQuery.attendeeCounts} onClose={() => setOpenVenueGroup(null)} onOpenEvent={openVenueEvent} />

      <Pressable style={styles.fab} onPress={onHostActivity} accessibilityLabel={t('discovery.hostActivity')}>
        <Plus size={24} color={theme.text.inverse} weight="bold" />
      </Pressable>

      <BottomSheet ref={sheetRef} index={SHEET_PEEK_INDEX} snapPoints={SNAP_POINTS} enableDynamicSizing={false} backgroundStyle={styles.sheetBackground} handleIndicatorStyle={styles.sheetHandle}>
        {/* ONE CHILD ONLY.
            @gorhom/bottom-sheet renders `children` into a single container of
            height `sheetHeight - handleHeight` with `overflow: hidden`, and its
            supported shape is exactly one content element. This screen used to
            pass five siblings — a header, three error banners and the list —
            and the scrollable claimed the content area, so everything above it
            was pushed outside the clipped box and never appeared. That is why
            Search/Filters/Sort were missing on device even after the header was
            changed from BottomSheetView to a plain View: the sibling structure,
            not the component type, was the defect.

            The toolbar is now the list's own sticky header, so there is one
            child, the controls survive every snap point, and they stay pinned
            while the feed scrolls. Purely presentational: no query, region or
            selection state is touched here. */}
        {showSkeleton ? (
          <View style={styles.listContent}>
            <DiscoverySheetHeader />
            {[0, 1, 2].map((index) => <View key={index} style={styles.feedItem}><SkeletonCard /></View>)}
          </View>
        ) : (
          <BottomSheetFlatList
            ref={listRef}
            ListHeaderComponent={<DiscoverySheetHeader />}
            stickyHeaderIndices={[0]}
            data={listItems}
            keyExtractor={discoveryItemKey}
            renderItem={({ item }: { item: DiscoveryItem }) => <View style={styles.feedItem}>{item.type === 'activity'
              ? <ActivityCard activity={item.data} variant="feed" onPress={() => openItem(item)} highlighted={discoverySelectionEquals(selectedItem, item)} />
              : item.type === 'place'
                ? <PlaceCard place={item.data} onPress={() => openItem(item)} highlighted={discoverySelectionEquals(selectedItem, item)} />
                : <EventCard event={item.data} attendeeCount={eventsQuery.attendeeCounts[item.data.occurrence.id] ?? 0} onPress={() => openItem(item)} highlighted={discoverySelectionEquals(selectedItem, item)} />}
            </View>}
            contentContainerStyle={styles.listContent}
            initialNumToRender={6}
            maxToRenderPerBatch={8}
            windowSize={7}
            removeClippedSubviews
            onEndReached={contentSelection.places && placesQuery.hasMore ? placesQuery.loadMore : undefined}
            onEndReachedThreshold={0.5}
            ListEmptyComponent={<DiscoveryEmptyState selection={contentSelection} locationDenied={position.locationDenied} onHostActivity={onHostActivity} />}
            onScrollToIndexFailed={({ index }) => setTimeout(() => listRef.current?.scrollToIndex({ index, animated: true }), 100)}
          />
        )}
      </BottomSheet>
    </View>
  );
}

function FilterRow<TKey extends string>({ label, items, selected, onSelect }: { label?: string; items: Array<{ key: TKey; labelKey: TranslationKey }>; selected: TKey; onSelect: (key: TKey) => void }) {
  const { t } = useI18n();
  return <View>{label ? <Text style={styles.filterLabel}>{label}</Text> : null}<FlatList horizontal showsHorizontalScrollIndicator={false} data={items} keyExtractor={(item) => item.key} contentContainerStyle={styles.chipRow} renderItem={({ item }) => <CategoryChip label={t(item.labelKey)} selected={selected === item.key} onPress={() => onSelect(item.key)} />} /></View>;
}

function ToolbarButton({ icon: Icon, label, onPress, active = false }: { icon: React.ComponentType<{ size: number; color: string }>; label: string; onPress: () => void; active?: boolean }) {
  return <Pressable style={[styles.toolbarButton, active && styles.toolbarButtonActive]} onPress={onPress} accessibilityRole="button"><Icon size={18} color={active ? theme.text.inverse : theme.text.primary} /><Text style={[styles.toolbarButtonText, active && styles.toolbarButtonTextActive]}>{label}</Text></Pressable>;
}

function ContentTypeOption({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const { t } = useI18n();
  return <Pressable style={styles.contentTypeOption} onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel={t('filters.showType', { type: label.toLocaleLowerCase() })}><View style={[styles.checkbox, selected && styles.checkboxSelected]}>{selected ? <Check size={14} color={theme.text.inverse} weight="bold" /> : null}</View><Text style={styles.contentTypeLabel}>{label}</Text></Pressable>;
}

function ModalSheet({ visible, title, onDismiss, children }: { visible: boolean; title: string; onDismiss: () => void; children: React.ReactNode }) {
  const { t } = useI18n();
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}><Pressable style={styles.modalOverlay} onPress={onDismiss}><Pressable style={styles.modalSheet} onPress={(event) => event.stopPropagation()}><View style={styles.modalHeader}><Text style={styles.modalTitle}>{title}</Text><Pressable onPress={onDismiss} accessibilityLabel={t('common.close', { what: title.toLocaleLowerCase() })} hitSlop={10}><X size={20} color={theme.text.primary} /></Pressable></View><ScrollView contentContainerStyle={styles.modalContent} keyboardShouldPersistTaps="handled">{children}</ScrollView></Pressable></Pressable></Modal>;
}

function QueryErrorBanner({ label, onRetry }: { label: string; onRetry: () => void }) {
  const { t } = useI18n();
  return <View style={styles.errorBanner}><WarningCircle size={17} color={theme.semantic.warning} weight="fill" /><Text style={styles.errorBannerText}>{label}</Text><Pressable onPress={onRetry} style={styles.retryButton} hitSlop={8} accessibilityRole="button" accessibilityLabel={t('common.retryLabel', { label })}><Text style={styles.retryText}>{t('common.retry')}</Text></Pressable></View>;
}

function DiscoveryEmptyState({ selection, locationDenied, onHostActivity }: { selection: DiscoveryContentSelection; locationDenied: boolean; onHostActivity: () => void }) {
  const { t } = useI18n();
  return <View style={styles.emptyState}><Text style={styles.emptyTitle}>{t(discoveryEmptyCopyKey(selection))}</Text><Text style={styles.emptyBody}>{t(locationDenied ? 'discovery.empty.bodyLocationOff' : 'discovery.empty.body')}</Text>{/* Only offered when Activities are selected — hosting would not affect a Places-only or Events-only result set, and an action that does nothing is worse than none. */}{selection.activities ? <Pressable style={styles.emptyAction} onPress={onHostActivity} accessibilityRole="button" accessibilityLabel={t('discovery.hostActivity')}><Text style={styles.emptyActionText}>{t('discovery.hostActivity')}</Text></Pressable> : null}</View>;
}

/** Returns the translation key for the result-count line. A mixed selection
 *  uses a type-neutral count, since naming three types in one line reads badly
 *  in both languages. */
export function discoveryCountKey(selection: DiscoveryContentSelection, count: number): TranslationKey {
  const keys = selectedContentKeys(selection);
  if (keys.length !== 1) return 'discovery.count.mixed';
  const plural = count === 1 ? 'one' : 'other';
  if (keys[0] === 'activities') return `discovery.count.activities.${plural}` as TranslationKey;
  if (keys[0] === 'places') return `discovery.count.places.${plural}` as TranslationKey;
  return `discovery.count.events.${plural}` as TranslationKey;
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
  toolbar: { flexDirection: 'row', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  toolbarButton: { flex: 1, minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.xs, borderRadius: radius.pill, backgroundColor: theme.background.surface, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5, shadowOffset: { width: 0, height: 2 } },
  toolbarButtonActive: { backgroundColor: theme.brand.primary },
  toolbarButtonText: { ...typography.subhead, color: theme.text.primary, fontWeight: '700' },
  toolbarButtonTextActive: { color: theme.text.inverse },
  searchRow: { marginHorizontal: spacing.lg, marginTop: spacing.sm, minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.pill, backgroundColor: theme.background.surface },
  searchInput: { flex: 1, ...typography.body, color: theme.text.primary, direction: 'ltr' },
  filterLabel: { ...typography.caption, color: theme.text.secondary, fontWeight: '700', paddingHorizontal: spacing.lg, marginTop: spacing.xs },
  chipRow: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  chipRowCompact: { paddingHorizontal: spacing.lg, paddingTop: 2 },
  wrapChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, paddingHorizontal: spacing.lg, paddingTop: spacing.xs },
  contentTypeHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingEnd: spacing.lg },
  selectAll: { ...typography.subhead, color: theme.brand.primary, fontWeight: '700' },
  contentTypeOptions: { paddingHorizontal: spacing.lg, gap: spacing.xs },
  contentTypeOption: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radius.md, backgroundColor: theme.background.app, paddingHorizontal: spacing.md },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: theme.border.strong, alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { backgroundColor: theme.brand.primary, borderColor: theme.brand.primary },
  contentTypeLabel: { ...typography.bodyMedium, color: theme.text.primary },
  filterNotice: { ...typography.footnote, color: theme.semantic.warning, paddingHorizontal: spacing.lg },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(43,43,40,0.4)' },
  modalSheet: { maxHeight: '82%', borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, backgroundColor: theme.background.surface, paddingBottom: spacing['2xl'] },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border.default },
  modalTitle: { ...typography.title3, color: theme.text.primary },
  modalContent: { paddingBottom: spacing.lg, gap: spacing.sm },
  resetAll: {
    // 48 keeps this above the 44pt minimum target even with tight padding.
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.lg,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.border.default,
  },
  resetAllText: { ...typography.bodyMedium, color: theme.text.accent },
  sortOptions: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, gap: spacing.xs },
  sortOption: { minHeight: 48, justifyContent: 'center', paddingHorizontal: spacing.md, borderRadius: radius.md, backgroundColor: theme.background.app },
  sortOptionSelected: { backgroundColor: theme.brand.primaryTint, borderWidth: 1, borderColor: theme.brand.primary },
  sortOptionText: { ...typography.bodyMedium, color: theme.text.primary },
  sortOptionTextSelected: { color: theme.brand.primary },
  sortHint: { ...typography.footnote, color: theme.text.secondary, paddingHorizontal: spacing.lg, marginTop: spacing.sm },
  fab: { position: 'absolute', right: spacing.lg, bottom: '24%', width: 54, height: 54, borderRadius: 27, backgroundColor: theme.brand.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 5, elevation: 5 },
  sheetBackground: { backgroundColor: theme.background.app },
  sheetHandle: { backgroundColor: theme.border.strong },
  // Opaque, because this is a sticky header scrolling over the feed.
  sheetHeader: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm, backgroundColor: theme.background.app },
  // Compact by design: one row, no wrapping, so it costs little of the sheet's
  // vertical space at the 22% peek snap point.
  toolbarSticky: { flexDirection: 'row', gap: spacing.sm, paddingBottom: spacing.sm },
  sheetTitle: { ...typography.headline, color: theme.text.primary },
  sheetSubtitle: { ...typography.footnote, color: theme.text.secondary, marginTop: 2 },
  listContent: { paddingHorizontal: spacing.lg, paddingBottom: 120 },
  feedItem: { width: '100%' },
  errorBanner: { marginHorizontal: spacing.lg, marginBottom: spacing.xs, minHeight: 44, paddingHorizontal: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.md, backgroundColor: theme.semantic.warningTint },
  errorBannerText: { flex: 1, ...typography.footnote, color: theme.text.primary },
  // The Pressable wraps only a text node, so without an explicit target it is
  // about the height of the text — far under the 44pt minimum.
  retryButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: spacing.xs },
  retryText: { ...typography.footnote, color: theme.brand.primary, fontWeight: '700' },
  emptyState: { alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.xl },
  emptyTitle: { ...typography.headline, color: theme.text.primary, textAlign: 'center' },
  emptyBody: { ...typography.body, color: theme.text.secondary, textAlign: 'center', marginTop: spacing.xs },
  emptyAction: { minHeight: 44, justifyContent: 'center', marginTop: spacing.md },
  emptyActionText: { ...typography.subhead, color: theme.brand.primary, fontWeight: '700' },
});
