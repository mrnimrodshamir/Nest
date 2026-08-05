import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { PROVIDER_DEFAULT, type Region } from 'react-native-maps';
import BottomSheet, { BottomSheetFlatList, BottomSheetView } from '@gorhom/bottom-sheet';
import { MapPinLine, WarningCircle } from 'phosphor-react-native';
import { CategoryChip } from '@/components/CategoryChip';
import { PlaceCard } from '@/components/PlaceCard';
import { PlaceMapPin } from '@/components/PlaceMapPin';
import { PlaceClusterMarker } from '@/components/PlaceClusterMarker';
import { SkeletonCard } from '@/components/SkeletonCard';
import { StateCard } from '@/components/StateCard';
import { FALLBACK_LOCATION } from '@/constants/location';
import { useFamilyFriendlyPlaces } from '@/hooks/useFamilyFriendlyPlaces';
import { radius, spacing, theme, typography } from '@/theme';
import type { FamilyFriendlyPlace, PlaceCategory, PlaceFilters } from '@/types/familyFriendlyPlace';
import { regionToPlaceViewport } from '@/utils/placeViewport';
import { clusterPlacesForRegion } from '@/utils/placeClustering';

const FILTERS: Array<{ key: PlaceCategory | 'all'; label: string }> = [
  { key: 'all', label: 'All' }, { key: 'playground', label: 'Playgrounds' }, { key: 'park', label: 'Parks' },
  { key: 'indoor_playground', label: 'Indoor play' }, { key: 'family_cafe', label: 'Cafés' },
  { key: 'museum', label: 'Museums' }, { key: 'beach', label: 'Beaches' }, { key: 'pool', label: 'Pools' },
];
const SNAP_POINTS = ['22%', '50%', '92%'];
type QuickFilter = 'babies' | 'toddlers' | 'kids' | 'indoor' | 'outdoor' | 'free' | 'paid' | 'changingTable' | 'toilets' | 'highChairs' | 'shade' | 'waterFountain' | 'accessible';
const QUICK_FILTERS: Array<{ key: QuickFilter; label: string }> = [
  { key: 'babies', label: 'Babies' }, { key: 'toddlers', label: 'Toddlers' }, { key: 'kids', label: 'Kids' },
  { key: 'indoor', label: 'Indoor' }, { key: 'outdoor', label: 'Outdoor' }, { key: 'free', label: 'Free' }, { key: 'paid', label: 'Paid' },
  { key: 'changingTable', label: 'Changing table' }, { key: 'toilets', label: 'Toilets' }, { key: 'highChairs', label: 'High chairs' },
  { key: 'shade', label: 'Shade' }, { key: 'waterFountain', label: 'Water' }, { key: 'accessible', label: 'Accessible' },
];

export function PlacesDiscoveryView({ onShowActivities, onOpenPlace, mockPlaces }: { onShowActivities: () => void; onOpenPlace: (place: FamilyFriendlyPlace) => void; mockPlaces?: FamilyFriendlyPlace[] }) {
  const mapRef = useRef<MapView>(null);
  const sheetRef = useRef<BottomSheet>(null);
  const [region, setRegion] = useState<Region>({ latitude: FALLBACK_LOCATION.latitude, longitude: FALLBACK_LOCATION.longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 });
  const [category, setCategory] = useState<PlaceCategory | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [quickFilters, setQuickFilters] = useState<Set<QuickFilter>>(() => new Set());
  const viewport = useMemo(() => regionToPlaceViewport(region), [region]);
  const filters = useMemo<PlaceFilters>(() => ({
    category: category === 'all' ? null : category,
    ageMonths: quickFilters.has('babies') ? 12 : quickFilters.has('toddlers') ? 36 : quickFilters.has('kids') ? 72 : null,
    environment: quickFilters.has('indoor') ? 'indoor' : quickFilters.has('outdoor') ? 'outdoor' : null,
    cost: quickFilters.has('free') ? 'free' : quickFilters.has('paid') ? 'paid' : null,
    changingTable: quickFilters.has('changingTable'), toilets: quickFilters.has('toilets'), highChairs: quickFilters.has('highChairs'),
    shade: quickFilters.has('shade'), waterFountain: quickFilters.has('waterFountain'), accessible: quickFilters.has('accessible'),
  }), [category, quickFilters]);
  const { places, isLoading, error, hasMore, refresh, loadMore } = useFamilyFriendlyPlaces({ enabled: true, viewport, filters, userCoordinate: null, mockPlaces });
  const mapItems = useMemo(() => clusterPlacesForRegion(places, region), [places, region]);

  const selectPlace = useCallback((place: FamilyFriendlyPlace, open = false) => {
    setSelectedId(place.id);
    mapRef.current?.animateToRegion({ latitude: place.latitude, longitude: place.longitude, latitudeDelta: 0.018, longitudeDelta: 0.018 }, 350);
    sheetRef.current?.snapToIndex(1);
    if (open) onOpenPlace(place);
  }, [onOpenPlace]);

  return <View style={styles.container}>
    <MapView ref={mapRef} provider={PROVIDER_DEFAULT} style={StyleSheet.absoluteFill} initialRegion={region} onRegionChangeComplete={setRegion} showsUserLocation showsMyLocationButton={false}>
      {mapItems.map((item) => item.kind === 'place'
        ? <PlaceMapPin key={item.place.id} place={item.place} selected={item.place.id === selectedId} onPress={selectPlace} />
        : <PlaceClusterMarker key={item.id} latitude={item.latitude} longitude={item.longitude} count={item.places.length} selected={item.places.some((place) => place.id === selectedId)} onPress={() => mapRef.current?.animateToRegion({ latitude: item.latitude, longitude: item.longitude, latitudeDelta: Math.max(region.latitudeDelta / 2, 0.004), longitudeDelta: Math.max(region.longitudeDelta / 2, 0.004) }, 300)} />)}
    </MapView>
    <SafeAreaView edges={['top']} style={styles.header} pointerEvents="box-none">
      <View style={styles.modeToggle}>
        <Pressable onPress={onShowActivities} style={styles.modeOption}><Text style={styles.modeText}>Activities</Text></Pressable>
        <View style={[styles.modeOption, styles.modeSelected]}><Text style={[styles.modeText, styles.modeTextSelected]}>Places</Text></View>
      </View>
      <FlatList horizontal showsHorizontalScrollIndicator={false} data={FILTERS} keyExtractor={(item) => item.key} contentContainerStyle={styles.filters} renderItem={({ item }) => <CategoryChip label={item.label} selected={category === item.key} onPress={() => setCategory(item.key)} />} />
      <FlatList horizontal showsHorizontalScrollIndicator={false} data={QUICK_FILTERS} keyExtractor={(item) => item.key} contentContainerStyle={styles.quickFilters} renderItem={({ item }) => <CategoryChip label={item.label} selected={quickFilters.has(item.key)} onPress={() => setQuickFilters((current) => { const next = new Set(current); const exclusive = item.key === 'indoor' ? ['outdoor'] : item.key === 'outdoor' ? ['indoor'] : item.key === 'free' ? ['paid'] : item.key === 'paid' ? ['free'] : ['babies','toddlers','kids'].includes(item.key) ? ['babies','toddlers','kids'].filter((key) => key !== item.key) : []; exclusive.forEach((key) => next.delete(key as QuickFilter)); next.has(item.key) ? next.delete(item.key) : next.add(item.key); return next; })} />} />
    </SafeAreaView>
    <BottomSheet ref={sheetRef} index={0} snapPoints={SNAP_POINTS} enableDynamicSizing={false} backgroundStyle={styles.sheet} handleIndicatorStyle={styles.handle}>
      <BottomSheetView style={styles.sheetHeader}><Text style={styles.sheetTitle}>{isLoading ? 'Finding places…' : `${places.length} places in this area`}</Text><Text style={styles.sheetSubtitle}>Curated for families</Text></BottomSheetView>
      {isLoading ? <BottomSheetView style={styles.list}>{[0, 1, 2].map((i) => <View key={i} style={styles.item}><SkeletonCard /></View>)}</BottomSheetView> :
        <BottomSheetFlatList data={places} keyExtractor={(item: FamilyFriendlyPlace) => item.id} renderItem={({ item }: { item: FamilyFriendlyPlace }) => <View style={styles.item}><PlaceCard place={item} highlighted={item.id === selectedId} onPress={(place) => selectPlace(place, true)} /></View>} contentContainerStyle={styles.list} onEndReached={hasMore ? loadMore : undefined} onEndReachedThreshold={0.5} initialNumToRender={6} maxToRenderPerBatch={8} windowSize={7} removeClippedSubviews ListEmptyComponent={<StateCard icon={error ? WarningCircle : MapPinLine} title={error ? "Couldn't load places" : 'No places match here yet'} body={error ?? (quickFilters.size || category !== 'all' ? 'Clear a filter or move the map to see more places.' : 'Move the map to explore another area.')} ctaLabel={error ? 'Try again' : quickFilters.size || category !== 'all' ? 'Clear filters' : undefined} onCtaPress={error ? refresh : quickFilters.size || category !== 'all' ? () => { setCategory('all'); setQuickFilters(new Set()); } : undefined} tone={error ? 'warning' : 'default'} />} />}
    </BottomSheet>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background.app }, header: { position: 'absolute', top: 0, left: 0, right: 0 },
  modeToggle: { alignSelf: 'center', marginTop: spacing.sm, flexDirection: 'row', padding: 3, borderRadius: radius.pill, backgroundColor: theme.background.surface, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  modeOption: { minWidth: 104, minHeight: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' }, modeSelected: { backgroundColor: theme.brand.primary },
  modeText: { ...typography.subhead, color: theme.text.secondary, fontWeight: '600' }, modeTextSelected: { color: theme.text.inverse },
  filters: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm }, quickFilters: { paddingHorizontal: spacing.lg, paddingTop: spacing.xs }, sheet: { backgroundColor: theme.background.app }, handle: { backgroundColor: theme.border.strong },
  sheetHeader: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }, sheetTitle: { ...typography.headline, color: theme.text.primary }, sheetSubtitle: { ...typography.footnote, color: theme.text.secondary, marginTop: 2 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 120 }, item: { width: '100%' },
});
