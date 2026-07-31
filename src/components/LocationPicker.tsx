import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator, Platform } from 'react-native';
import MapView, { PROVIDER_DEFAULT, type Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { MagnifyingGlass, MapPin, X } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';
import { usePlaceSearch, type PlaceResult } from '@/hooks/usePlaceSearch';

interface LocationPickerProps {
  latitude: number;
  longitude: number;
  onChangeCoordinates: (latitude: number, longitude: number) => void;
  /** Called whenever the map settles on a new spot (drag) or a search
   *  result is picked — the host screen owns the actual "Location name"
   *  text field and can still let the parent edit it by hand afterward. */
  onChangeLocationName?: (name: string) => void;
  /** Centers on the parent's current location on first mount, when
   *  permission is already granted — only appropriate for a brand-new
   *  activity, never when editing one that already has a real location. */
  autoCenterOnMount?: boolean;
}

const DELTA = 0.02;

/** Wolt/Uber-style picker — the map itself is the primary input and works
 *  fully on its own. A pin stays fixed in the visual center; the parent
 *  drags the map underneath it, and once it settles we reverse-geocode the
 *  center point and fill the location name automatically. Coordinates are
 *  always preserved even if reverse geocoding comes back empty — a name is
 *  a convenience, the pin position is the real data.
 *
 *  Search is a secondary shortcut on top of that, backed by
 *  expo-location's free on-device geocoder — see usePlaceSearch. If
 *  search fails for any reason, dragging the map keeps working exactly
 *  as before; nothing about it depends on search succeeding. */
export function LocationPicker({
  latitude,
  longitude,
  onChangeCoordinates,
  onChangeLocationName,
  autoCenterOnMount = false,
}: LocationPickerProps) {
  const [isResolving, setIsResolving] = useState(false);
  const mapRef = useRef<MapView>(null);
  // Guards against a slow reverse-geocode response landing after a newer
  // drag — only the most recent request is allowed to write back a result.
  const requestId = useRef(0);
  const search = usePlaceSearch({ latitude, longitude });

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
      // parent actually chose are already saved via onChangeCoordinates.
    } finally {
      if (thisRequest === requestId.current) setIsResolving(false);
    }
  };

  const handleRegionChangeComplete = (region: Region) => {
    onChangeCoordinates(region.latitude, region.longitude);
    void resolveName(region.latitude, region.longitude);
  };

  const handleSelectResult = (result: PlaceResult) => {
    onChangeCoordinates(result.latitude, result.longitude);
    onChangeLocationName?.(result.name);
    mapRef.current?.animateToRegion(
      { latitude: result.latitude, longitude: result.longitude, latitudeDelta: DELTA, longitudeDelta: DELTA },
      400,
    );
    search.clear();
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <MagnifyingGlass size={16} color={theme.text.muted} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search for a place or address"
          placeholderTextColor={theme.text.muted}
          value={search.query}
          onChangeText={search.setQuery}
          returnKeyType="search"
        />
        {search.status === 'loading' ? (
          <ActivityIndicator color={theme.text.muted} size="small" style={styles.searchTrailing} />
        ) : search.query.length > 0 ? (
          <Pressable onPress={search.clear} hitSlop={8} style={styles.searchTrailing}>
            <X size={16} color={theme.text.muted} />
          </Pressable>
        ) : null}
      </View>

      {search.status === 'results' && (
        <View style={styles.resultsList}>
          {search.results.map((result) => (
            <Pressable key={result.id} style={styles.resultRow} onPress={() => handleSelectResult(result)}>
              <MapPin size={16} color={theme.brand.primary} />
              <View style={styles.resultBody}>
                <Text style={styles.resultName} numberOfLines={1}>
                  {result.name}
                </Text>
                {result.formattedAddress ? (
                  <Text style={styles.resultAddress} numberOfLines={1}>
                    {result.formattedAddress}
                  </Text>
                ) : null}
              </View>
            </Pressable>
          ))}
        </View>
      )}
      {search.status === 'empty' && (
        <Text style={styles.searchStatusText}>No matching places found — try a more specific search</Text>
      )}
      {(search.status === 'error' || search.status === 'unavailable') && search.errorMessage && (
        <Text style={styles.searchStatusText}>{search.errorMessage}</Text>
      )}

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
  searchStatusText: { ...typography.caption, color: theme.text.muted },
  resultsList: {
    backgroundColor: theme.background.surface,
    borderWidth: 1,
    borderColor: theme.border.default,
    borderRadius: radius.md,
    overflow: 'hidden',
  },
  resultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: theme.border.default,
  },
  resultBody: { flex: 1 },
  resultName: { ...typography.bodyMedium, color: theme.text.primary },
  resultAddress: { ...typography.caption, color: theme.text.muted },
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
