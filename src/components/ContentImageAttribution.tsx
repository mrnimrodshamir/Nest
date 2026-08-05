import React from 'react';
import { Linking, Pressable, StyleSheet, Text } from 'react-native';
import { theme, typography } from '@/theme';
import type { ContentImageAsset } from '@/types/contentImage';

export function ContentImageAttribution({ image }: { image: ContentImageAsset }) {
  const text = image.rights.attributionText ?? `Image: ${image.rights.sourceName}`;
  const url = image.rights.attributionUrl ?? image.rights.sourceUrl;
  if (!url) return <Text style={styles.text}>{text}</Text>;
  return <Pressable accessibilityRole="link" onPress={() => Linking.openURL(url)}><Text style={styles.link}>{text}</Text></Pressable>;
}

const styles = StyleSheet.create({
  text: { ...typography.caption, color: theme.text.muted },
  link: { ...typography.caption, color: theme.brand.primary, textDecorationLine: 'underline' },
});
