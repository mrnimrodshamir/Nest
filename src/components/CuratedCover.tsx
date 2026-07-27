import React from 'react';
import { StyleSheet, View, Text, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { ActivityCategory } from '@/types/activity';
import { CATEGORY_EMOJI } from '@/types/activity';

/** Curated fallback covers: a tasteful gradient per category rather than a
 *  stock photo or an AI-illustration look. Referenced via a `curated:` URL
 *  scheme in cover_image_url (see isCuratedCover/parseCuratedCover) so
 *  storage stays a single text column instead of needing a separate flag. */
const CATEGORY_GRADIENT: Record<ActivityCategory, [string, string]> = {
  stroller_walk: ['#B8D4BC', '#7C9A82'],
  baby_playtime: ['#C7D9CA', '#7C9A82'],
  picnic: ['#E4ECE5', '#7C9A82'],
  coffee_meetup: ['#E3D5C0', '#C9A876'],
  workshop: ['#F1E4CE', '#C9A876'],
  fitness: ['#C7DEE6', '#8FB4C9'],
  yoga: ['#E6EFF3', '#8FB4C9'],
  other: ['#E3E0D6', '#A8A69C'],
};

const CURATED_PREFIX = 'curated:';

export function curatedCoverUrl(category: ActivityCategory): string {
  return `${CURATED_PREFIX}${category}`;
}

export function parseCuratedCover(url: string | null): ActivityCategory | null {
  if (!url || !url.startsWith(CURATED_PREFIX)) return null;
  return url.slice(CURATED_PREFIX.length) as ActivityCategory;
}

export function CuratedCover({ category, style }: { category: ActivityCategory; style?: StyleProp<ViewStyle> }) {
  const [start, end] = CATEGORY_GRADIENT[category];
  return (
    <LinearGradient colors={[start, end]} style={[styles.fill, style]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <View style={styles.emojiCircle}>
        <Text style={styles.emoji}>{CATEGORY_EMOJI[category]}</Text>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emojiCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: { fontSize: 28 },
});
