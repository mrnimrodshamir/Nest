import React from 'react';
import { StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path, Ellipse } from 'react-native-svg';
import type { ActivityCategory, CategoryArtFamily } from '@/types/activity';
import { CATEGORY_ART_FAMILY } from '@/types/activity';

/** TEMPORARY FALLBACK — not the final visual requirement. Rendered only by
 *  CategoryArtwork.tsx, and only for categories that don't have a final
 *  bundled photo/illustration yet (see activityArtManifest.ts /
 *  activityArtAssets.ts). Every category falls back to this today.
 *
 *  Hand-authored vector art (four coherent illustration "families" —
 *  see CATEGORY_ART_FAMILY — each showing several parents together,
 *  never one isolated figure) built from the same visual vocabulary as
 *  the NestUp brand mark (src/components/NestUpLogo.tsx: a circle head + a
 *  soft curved body). It exists because no image-generation tool is
 *  available in this environment to produce the premium
 *  editorial/photographic artwork the product actually calls for — it is
 *  a structural placeholder (no emoji, no lonely figure, no flat
 *  clipart), not a substitute for real art direction. Do not present
 *  this as the completed visual requirement.
 *
 *  Referenced via a `curated:` URL scheme in cover_image_url for
 *  activities created before this system existed (parseCuratedCover) —
 *  current activities simply leave cover_image_url null and let
 *  CoverImage/CategoryArtwork render the category's art automatically. */

const FAMILY_GRADIENT: Record<CategoryArtFamily, [string, string]> = {
  outdoors: ['#C7D9CA', '#7C9A82'],
  social: ['#E3D5C0', '#C9A876'],
  active: ['#C7DEE6', '#6FA8A0'],
  indoor: ['#F1E4CE', '#D98C72'],
};

const FAMILY_FIGURE_COLORS: Record<CategoryArtFamily, string[]> = {
  outdoors: ['#F28C86', '#A894D6', '#F2B8A2'],
  social: ['#C97B5C', '#8FA37C', '#D6A6C8'],
  active: ['#4F7A73', '#7C5C9E', '#3D6B84'],
  indoor: ['#B65F4A', '#6E8F6B', '#9C6FA8'],
};

const CURATED_PREFIX = 'curated:';

export function curatedCoverUrl(category: ActivityCategory): string {
  return `${CURATED_PREFIX}${category}`;
}

export function parseCuratedCover(url: string | null): ActivityCategory | null {
  if (!url || !url.startsWith(CURATED_PREFIX)) return null;
  return url.slice(CURATED_PREFIX.length) as ActivityCategory;
}

/** One simplified parent figure — a head circle plus a soft rounded body,
 *  the same two-shape vocabulary as the brand mark. Deliberately abstract
 *  (no facial features, no gender markers) so a small group reads as
 *  "parents together" at a glance without drifting into a cartoon-character
 *  look. */
function ParentFigure({ x, y, scale, color }: { x: number; y: number; scale: number; color: string }) {
  return (
    <>
      <Ellipse cx={x} cy={y + 46 * scale} rx={30 * scale} ry={38 * scale} fill={color} opacity={0.92} />
      <Circle cx={x} cy={y - 6 * scale} r={17 * scale} fill={color} />
    </>
  );
}

function FamilyScene({ family }: { family: CategoryArtFamily }) {
  const colors = FAMILY_FIGURE_COLORS[family];
  return (
    <Svg width="100%" height="100%" viewBox="0 0 300 160" preserveAspectRatio="xMidYMid slice">
      {/* Ground line — gives every scene a shared sense of place without a photo. */}
      <Path d="M 0 138 Q 150 118 300 138 L 300 160 L 0 160 Z" fill="#000000" opacity={0.05} />
      <ParentFigure x={104} y={78} scale={0.85} color={colors[0]} />
      <ParentFigure x={160} y={70} scale={1} color={colors[1]} />
      <ParentFigure x={210} y={82} scale={0.8} color={colors[2]} />
    </Svg>
  );
}

export function CuratedCover({ category, style }: { category: ActivityCategory; style?: StyleProp<ViewStyle> }) {
  // Falls back to 'social' for any category value that isn't in the map
  // (a future category added to the DB enum before this file catches up)
  // — never crashes on an unrecognized key.
  const family = CATEGORY_ART_FAMILY[category] ?? 'social';
  const [start, end] = FAMILY_GRADIENT[family];
  return (
    <LinearGradient colors={[start, end]} style={[styles.fill, style]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
      <View style={StyleSheet.absoluteFill}>
        <FamilyScene family={family} />
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, overflow: 'hidden' },
});
