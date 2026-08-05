import React from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { ImageSquare } from 'phosphor-react-native';
import { ContentImage } from '@/components/ContentImage';
import { radius, spacing, theme, typography } from '@/theme';
import type { ContentImageAsset } from '@/types/contentImage';

export function ContentImageGallery({ images, title = 'Gallery' }: { images: ContentImageAsset[]; title?: string }) {
  const approved = images.filter((image) => image.rights.rightsStatus === 'approved');
  if (!approved.length) return null;
  return <View style={styles.section}>
    <Text style={styles.title}>{title}</Text>
    <FlatList
      horizontal
      data={approved}
      keyExtractor={(item) => item.id}
      initialNumToRender={2}
      maxToRenderPerBatch={2}
      windowSize={3}
      removeClippedSubviews
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => <ContentImage asset={item} variant="gallery" style={styles.image} fallback={<ImageSquare size={34} color={theme.text.muted} />} accessibilityLabel={item.altText} />}
    />
  </View>;
}

const styles = StyleSheet.create({
  section: { gap: spacing.xs },
  title: { ...typography.headline, color: theme.text.primary },
  list: { gap: spacing.sm },
  image: { width: 248, aspectRatio: 4 / 3, borderRadius: radius.lg, backgroundColor: theme.background.surfaceAlt },
});
