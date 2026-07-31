import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import MapView, { PROVIDER_DEFAULT, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { MagnifyingGlass, MapPin, X } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';

interface LocationPickerProps {
  latitude: number;
  longitude: number;
  onChangeCoordinates: (latitude: number, longitude: number) => void;
  /** Called whenever the map settles on a new spot (drag) or a search
   *  result is picked — the host screen owns the actual "Location name"
   *  text field and can still let the mother edit it by hand afterward. */
  onChangeLocationName?: (name: string) => void;
  /** Centers on the mother's current location on first mount, when
   *  permission is already granted — only appropriate for a brand-new
   *  activity, never when editing one that already has a real location. */
  autoCenterOnMount?: boolean;
}

const DELTA = 0.02;

/** Wolt/Uber-style picker — the map itself is the primary input. A pin
 *  stays fixed in the visual center; the mother drags the map underneath
 *  it, and once it settles we reverse-geocode the center point and fill
 *  the location name automatically. Search is a secondary shortcut: pick
 *  a result and the map recenters there, same settle-and-geocode flow.
 *  Coordinates are always preserved even if reverse geocoding comes back
 *  empty — a name is a convenience, the pin position is the real data. */
export function LocationPicker({
  latitude,
  longitude,
  onChangeCoordinates,
  onChangeLocationName,
  autoCenterOnMount = false,
}: LocationPickerProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const mapRef = useRef<MapView>(null);
  // Guards against a slow geocode response landing after a newer drag —
  // only the most recent request is allowed to write back a result.
  const requestId = useRef(0);

  useEffect(() => {
    if (!autoCenterOnMount) return;
    (async () => {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== 'granted') return;
      try {
        const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        onChangeCoordinates(position.coords.latitude, position.coords.longitude);
        mapRef.current?.animateToRegion(
          {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            latitudeDelta: DELTA,
            longitudeDelta: DELTA,
          },
          400,
        );
      } catch {
        // No current position available — keep the default region.
      }
    })();
    // Only ever run once, on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const resolveName = async (lat: number, lng: number) => {
    const thisRequest = ++requestId.current;
    setIsResolving(true);
    try {
      const results = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (thisRequest !== requestId.current) return; // a newer drag/search superseded this
      const place = results[0];
      if (place && onChangeLocationName) {
        const label = [place.name, place.street].filter(Boolean).join(' ') || place.name || place.street;
        if (label) onChangeLocationName(label);
      }
    } catch {
      // Reverse geocoding failing is non-fatal — the coordinates the
      // mother actually chose are already saved via onChangeCoordinates.
    } finally {
      if (thisRequest === requestId.current) setIsResolving(false);
    }
  };

  const handleRegionChangeComplete = (region: Region) => {
    onChangeCoordinates(region.latitude, region.longitude);
    void resolveName(region.latitude, region.longitude);
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setSearchError(null);
    const thisRequest = ++requestId.current;
    try {
      const results = await Location.geocodeAsync(query.trim());
      if (thisRequest !== requestId.current) return;
      if (results.length === 0) {
        setSearchError('No matching place found — try a more specific search');
        return;
      }
      const { latitude: lat, longitude: lng } = results[0];
      onChangeCoordinates(lat, lng);
      // Use what the mother actually typed as the initial name — it's
      // usually more recognizable than whatever a reverse-geocode returns
      // (e.g. "HaYarkon Park" vs. a street address) — then let a
      // background reverse-geocode refine it if it finds something.
      onChangeLocationName?.(query.trim());
      mapRef.current?.animateToRegion(
        { latitude: lat, longitude: lng, latitudeDelta: DELTA, longitudeDelta: DELTA },
        400,
      );
    } catch {
      if (thisRequest === requestId.current) setSearchError('Search failed — check your connection and try again');
    } finally {
      if (thisRequest === requestId.current) setIsSearching(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <MagnifyingGlass size={16} color={theme.text.muted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search for a place or address"
          placeholderTextColor={theme.text.muted}
          value={query}
          onChangeText={(text) => {
            setQuery(text);
            if (searchError) setSearchError(null);
          }}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        {isSearching ? (
          <ActivityIndicator color={theme.text.muted} size="small" style={styles.searchTrailing} />
        ) : query.length > 0 ? (
          <Pressable onPress={() => setQuery('')} hitSlop={8} style={styles.searchTrailing}>
            <X size={16} color={theme.text.muted} />
          </Pressable>
        ) : null}
      </View>
      {searchError && <Text style={styles.error}>{searchError}</Text>}

      <View style={styles.mapWrapper}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_DEFAULT}
          style={styles.map}
          initialRegion={{
            latitude,
            longitude,
            latitudeDelta: DELTA,
            longitudeDelta: DELTA,
          }}
          onRegionChangeComplete={handleRegionChangeComplete}
        />
        <View style={styles.centerPinWrap} pointerEvents="none">
          <MapPin size={32} color={theme.brand.primary} weight="fill" />
        </View>
        {isResolving && (
          <View style={styles.resolvingBadge}>
            <ActivityIndicator color={theme.text.secondary} size="small" />
          </View>
        )}
      </View>
      <Text style={styles.hint}>Drag the map to set the spot. Choose a public place, not a home address.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    backgroundColor: theme.background.surface,
    borderWidth: 1,
    borderColor: theme.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
  },
  searchIcon: {},
  searchInput: {
    flex: 1,
    ...typography.body,
    paddingVertical: spacing.md,
    color: theme.text.primary,
  },
  searchTrailing: { marginLeft: spacing.xs },
  error: { ...typography.caption, color: theme.semantic.danger },
  mapWrapper: {
    height: 220,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  map: { flex: 1 },
  centerPinWrap: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginLeft: -16,
    marginTop: -32,
    ...Platform.select({ ios: {}, default: {} }),
  },
  resolvingBadge: {
    position: 'absolute',
    top: spacing.sm,
    right: spacing.sm,
    backgroundColor: 'rgba(254,253,251,0.92)',
    borderRadius: radius.pill,
    padding: spacing.xs,
  },
  hint: { ...typography.caption, color: theme.text.muted },
});
