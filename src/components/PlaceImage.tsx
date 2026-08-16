import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { ContentImage } from '@/components/ContentImage';
import { CategoryArtwork } from '@/components/CategoryArtwork';
import { theme } from '@/theme';
import type { ActivityCategory } from '@/types/activity';
import type { ContentImageAsset } from '@/types/contentImage';
import type { PlaceCategory } from '@/types/familyFriendlyPlace';
import { useI18n } from '@/i18n';

const CATEGORY_ART: Record<PlaceCategory, ActivityCategory> = {
  playground: 'playground_meetup', park: 'stroller_walk', picnic_area: 'picnic',
  indoor_playground: 'indoor_playground', museum: 'museum', library: 'story_time',
  community_center: 'workshop', zoo_or_animals: 'zoo', beach: 'beach', pool: 'swimming',
  attraction: 'other', other: 'other',
};

const CATEGORY_COLORS: Record<PlaceCategory, string> = {
  playground: '#D9EEF0', park: '#E0EEDF', indoor_playground: '#ECE4F6',
  zoo_or_animals: '#E9EDDA', museum: '#E4E8F1', library: '#EEE6F0', beach: '#DDEFF8', pool: '#DDF1F3',
  community_center: '#F1E7E4', attraction: '#F5E5EC', picnic_area: '#E4EEDF', other: theme.background.surfaceAlt,
};

export function PlaceImage({ uri, asset, category, variant, style, name }: { uri: string | null; asset?: ContentImageAsset | null; category: PlaceCategory; variant: 'card' | 'cover'; style?: StyleProp<ViewStyle>; name?: string }) {
  const { t } = useI18n();
  return <ContentImage
    asset={asset}
    legacyUri={uri}
    variant={variant}
    style={[variant === 'card' ? styles.card : styles.cover, style, { backgroundColor: CATEGORY_COLORS[category] }]}
    accessibilityLabel={name ? t('map.imageLabel', { name }) : undefined}
    fallback={<CategoryArtwork category={CATEGORY_ART[category]} variant={variant === 'cover' ? 'hero' : 'card'} surface="PlaceImage" style={styles.artwork} />}
  />;
}

const styles = StyleSheet.create({
  // DEFINITE height, not minHeight. `minHeight` leaves the box's height
  // indefinite, which is what stopped the fallback's `height: '100%'` from
  // resolving and let a ~900pt intrinsic asset drive the whole card.
  // alignSelf keeps the row's default `stretch` from reintroducing it.
  card: { width: 112, height: 116, alignSelf: 'flex-start', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cover: { width: '100%', aspectRatio: 4 / 3, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  artwork: { width: '100%', height: '100%' },
});
