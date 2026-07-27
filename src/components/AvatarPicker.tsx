import React from 'react';
import { View, Text, Pressable, Image, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'phosphor-react-native';
import { theme, typography, spacing, radius } from '@/theme';

interface AvatarPickerProps {
  uri: string | null;
  onChange: (uri: string | null) => void;
}

export function AvatarPicker({ uri, onChange }: AvatarPickerProps) {
  const handlePick = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled && result.assets[0]) {
      onChange(result.assets[0].uri);
    }
  };

  return (
    <View style={styles.container}>
      <Pressable style={styles.circle} onPress={handlePick} accessibilityLabel="Choose profile photo">
        {uri ? (
          <Image source={{ uri }} style={styles.image} />
        ) : (
          <Camera size={26} color={theme.text.secondary} />
        )}
      </Pressable>
      <Text style={styles.hint}>{uri ? 'Change photo' : 'Add a photo (optional)'}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.sm },
  circle: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    backgroundColor: theme.brand.primaryTint,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: theme.border.default,
  },
  image: { width: '100%', height: '100%' },
  hint: { ...typography.footnote, color: theme.text.accent },
});
