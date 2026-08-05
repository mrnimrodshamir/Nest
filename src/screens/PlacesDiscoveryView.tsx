import React, { useCallback, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { PROVIDER_DEFAULT, type Region } from 'react-native-maps';
import BottomSheet, { BottomSheetFlatList, BottomSheetView } from '@gorhom/bottom-sheet';
import { MapPinLine, WarningCircle } from 'phosphor-react-native';
import { CategoryChip } from '@/components/CategoryChip';
import { PlaceCard } from '@/components/PlaceCard';
import { PlaceMapPin } from '@/components/PlaceMapPin';
import { SkeletonCard } from '@/components/SkeletonCard';
import { StateCard } from '@/components/StateCard';
import { FALLBACK_LOCATION } from '@/constants/location';
import { useFamilyFriendlyPlaces } from '@/hooks/useFamilyFriendlyPlaces';
import { radius, spacing, theme, typography } from '@/theme';
import type { FamilyFriendlyPlace, PlaceCategory } from '@/types/familyFriendlyPlace';
import { regionToPlaceViewport } from '@/utils/placeViewport';

const FILTERS: Array<{ key: PlaceCategory | 'all'; label: string }> = [
  { key: 'all', label: 'All' }, { key: 'playground', label: 'Playgrounds' }, { key: 'park', label: 'Parks' },
  { key: 'indoor_playground', label: 'Indoor play' }, { key: 'family_cafe', label: 'Cafés' },
  { key: 'museum', label: 'Museums' }, { key: 'beach', label: 'Beaches' }, { key: 'pool', label: 'Pools' },
];
const SNAP_POINTS = ['22%', '50%', '92%'];

export function PlacesDiscoveryView({ onShowActivities, onOpenPlace, mockPlaces }: { onShowActivities: () => void; onOpenPlace: (place: FamilyFriendlyPlace) => void; mockPlaces?: FamilyFriendlyPlace[] }) {
  const mapRef = useRef<MapView>(null);
  const sheetRef = useRef<BottomSheet>(null);
  const [region, setRegion] = useState<Region>({ latitude: FALLBACK_LOCATION.latitude, longitude: FALLBACK_LOCATION.longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 });
  const [category, setCategory] = useState<PlaceCategory | 'all'>('all');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const viewport = useMemo(() => regionToPlaceViewport(region), [region]);
  const filters = useMemo(() => ({ category: category === 'all' ? null : category }), [category]);
  const { places, isLoading, error, refresh } = useFamilyFriendlyPlaces({ enabled: true, viewport, filters, userCoordinate: null, mockPlaces });

  const selectPlace = useCallback((place: FamilyFriendlyPlace, open = false) => {
    setSelectedId(place.id);
    mapRef.current?.animateToRegion({ latitude: place.latitude, longitude: place.longitude, latitudeDelta: 0.018, longitudeDelta: 0.018 }, 350);
    sheetRef.current?.snapToIndex(1);
    if (open) onOpenPlace(place);
  }, [onOpenPlace]);

  return <View style={styles.container}>
    <MapView ref={mapRef} provider={PROVIDER_DEFAULT} style={StyleSheet.absoluteFill} initialRegion={region} onRegionChangeComplete={setRegion} showsUserLocation showsMyLocationButton={false}>
      {places.map((place) => <PlaceMapPin key={place.id} place={place} selected={place.id === selectedId} onPress={selectPlace} />)}
    </MapView>
    <SafeAreaView edges={['top']} style={styles.header} pointerEvents="box-none">
      <View style={styles.modeToggle}>
        <Pressable onPress={onShowActivities} style={styles.modeOption}><Text style={styles.modeText}>Activities</Text></Pressable>
        <View style={[styles.modeOption, styles.modeSelected]}><Text style={[styles.modeText, styles.modeTextSelected]}>Places</Text></View>
      </View>
      <FlatList horizontal showsHorizontalScrollIndicator={false} data={FILTERS} keyExtractor={(item) => item.key} contentContainerStyle={styles.filters} renderItem={({ item }) => <CategoryChip label={item.label} selected={category === item.key} onPress={() => setCategory(item.key)} />} />
    </SafeAreaView>
    <BottomSheet ref={sheetRef} index={0} snapPoints={SNAP_POINTS} enableDynamicSizing={false} backgroundStyle={styles.sheet} handleIndicatorStyle={styles.handle}>
      <BottomSheetView style={styles.sheetHeader}><Text style={styles.sheetTitle}>{isLoading ? 'Finding places…' : `${places.length} places in this area`}</Text><Text style={styles.sheetSubtitle}>Curated for families</Text></BottomSheetView>
      {isLoading ? <BottomSheetView style={styles.list}>{[0, 1, 2].map((i) => <View key={i} style={styles.item}><SkeletonCard /></View>)}</BottomSheetView> :
        <BottomSheetFlatList data={places} keyExtractor={(item: FamilyFriendlyPlace) => item.id} renderItem={({ item }: { item: FamilyFriendlyPlace }) => <View style={styles.item}><PlaceCard place={item} highlighted={item.id === selectedId} onPress={(place) => selectPlace(place, true)} /></View>} contentContainerStyle={styles.list} ListEmptyComponent={<StateCard icon={error ? WarningCircle : MapPinLine} title={error ? "Couldn't load places" : 'No curated places in this area yet'} body={error ?? 'Move the map or try another category.'} ctaLabel={error ? 'Try again' : category !== 'all' ? 'Clear filter' : undefined} onCtaPress={error ? refresh : category !== 'all' ? () => setCategory('all') : undefined} tone={error ? 'warning' : 'default'} />} />}
    </BottomSheet>
  </View>;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background.app }, header: { position: 'absolute', top: 0, left: 0, right: 0 },
  modeToggle: { alignSelf: 'center', marginTop: spacing.sm, flexDirection: 'row', padding: 3, borderRadius: radius.pill, backgroundColor: theme.background.surface, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 6, shadowOffset: { width: 0, height: 2 } },
  modeOption: { minWidth: 104, minHeight: 38, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' }, modeSelected: { backgroundColor: theme.brand.primary },
  modeText: { ...typography.subhead, color: theme.text.secondary, fontWeight: '600' }, modeTextSelected: { color: theme.text.inverse },
  filters: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm }, sheet: { backgroundColor: theme.background.app }, handle: { backgroundColor: theme.border.strong },
  sheetHeader: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm }, sheetTitle: { ...typography.headline, color: theme.text.primary }, sheetSubtitle: { ...typography.footnote, color: theme.text.secondary, marginTop: 2 },
  list: { paddingHorizontal: spacing.lg, paddingBottom: 120 }, item: { width: '100%' },
});
