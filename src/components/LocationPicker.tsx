import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import MapView, { Marker, PROVIDER_DEFAULT } from 'react-native-maps';
import * as Location from 'expo-location';
import { MagnifyingGlass } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';

interface LocationPickerProps {
  latitude: number;
  longitude: number;
  onChangeCoordinates: (latitude: number, longitude: number) => void;
}

export function LocationPicker({ latitude, longitude, onChangeCoordinates }: LocationPickerProps) {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!query.trim()) return;
    setIsSearching(true);
    setSearchError(null);
    try {
      const results = await Location.geocodeAsync(query.trim());
      if (results.length === 0) {
        setSearchError('No matching place found — try a more specific search');
        return;
      }
      onChangeCoordinates(results[0].latitude, results[0].longitude);
    } catch {
      setSearchError('Search failed — check your connection and try again');
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.searchRow}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search for a place or address"
          placeholderTextColor={theme.text.muted}
          value={query}
          onChangeText={setQuery}
          onSubmitEditing={handleSearch}
          returnKeyType="search"
        />
        <Pressable style={styles.searchButton} onPress={handleSearch} disabled={isSearching}>
          {isSearching ? (
            <ActivityIndicator color={theme.text.inverse} size="small" />
          ) : (
            <MagnifyingGlass size={18} color={theme.text.inverse} />
          )}
        </Pressable>
      </View>
      {searchError && <Text style={styles.error}>{searchError}</Text>}

      <View style={styles.mapWrapper}>
        <MapView
          provider={PROVIDER_DEFAULT}
          style={styles.map}
          region={{
            latitude,
            longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
          }}
        >
          <Marker
            coordinate={{ latitude, longitude }}
            draggable
            onDragEnd={(e) => {
              const { latitude: lat, longitude: lng } = e.nativeEvent.coordinate;
              onChangeCoordinates(lat, lng);
            }}
          />
        </MapView>
      </View>
      <Text style={styles.hint}>Drag the pin to fine-tune. Choose a public place, not a home address.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.sm },
  searchRow: { flexDirection: 'row', gap: spacing.sm },
  searchInput: {
    flex: 1,
    ...typography.body,
    backgroundColor: theme.background.surface,
    borderWidth: 1,
    borderColor: theme.border.default,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: theme.text.primary,
  },
  searchButton: {
    width: 48,
    borderRadius: radius.md,
    backgroundColor: theme.brand.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { ...typography.caption, color: theme.semantic.danger },
  mapWrapper: {
    height: 200,
    borderRadius: radius.lg,
    overflow: 'hidden',
  },
  map: { flex: 1 },
  hint: { ...typography.caption, color: theme.text.muted },
});
