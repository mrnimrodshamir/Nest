import { ACTIVITY_ART_MANIFEST } from '../constants/activityArtManifest';
import type { ActivityCategory } from '../types/activity';
import type { ActivityArtVariant } from '../constants/activityArtVariant';

export type { ActivityArtVariant } from '../constants/activityArtVariant';

/** Generic over the installed-asset value type so this stays a plain,
 *  dependency-free module — the real map (activityArtAssets.ts) types its
 *  values as React Native's ImageSourcePropType, but this resolver only
 *  ever checks presence/absence, never touches the value itself. */
export type ActivityArtAssetMap = Partial<Record<ActivityCategory, Partial<Record<ActivityArtVariant, unknown>>>>;

export interface ResolvedActivityArt {
  /** 'photo' when a real installed asset was found (possibly the "other"
   *  category's asset for the same variant); 'placeholder' when nothing at
   *  all is installed yet and the caller should render the aspect-neutral
   *  SVG placeholder scene instead of a photo. */
  kind: 'photo' | 'placeholder';
  /** Which category's asset to actually render — only set when kind is
   *  'photo'. Always look this up together with the variant that was
   *  requested; never a different one. */
  resolvedCategory?: ActivityCategory;
  /** Non-null when the caller should log a dev-time warning. */
  warning: string | null;
}

function isKnownCategory(category: string): category is ActivityCategory {
  return category in ACTIVITY_ART_MANIFEST;
}

/** Decides what art to render for a category+variant, given the currently
 *  installed asset map. Never substitutes a different aspect ratio for a
 *  missing one — a missing thumb never becomes a card, a missing card
 *  never becomes a hero. Resolution order:
 *    1. The exact category+variant, if installed.
 *    2. The "other" category's SAME variant, if installed (covers both an
 *       unknown/deprecated category and a known category simply missing
 *       this one variant so far).
 *    3. An aspect-neutral placeholder scene — never a wrongly-shaped photo. */
export function resolveActivityArt(
  category: string,
  variant: ActivityArtVariant,
  assets: ActivityArtAssetMap,
): ResolvedActivityArt {
  const known = isKnownCategory(category);
  const effectiveCategory: ActivityCategory = known ? category : 'other';

  if (assets[effectiveCategory]?.[variant]) {
    return {
      kind: 'photo',
      resolvedCategory: effectiveCategory,
      warning: known ? null : `Unknown activity category "${category}" — using "other" artwork.`,
    };
  }

  const otherHasIt = effectiveCategory !== 'other' && Boolean(assets.other?.[variant]);
  if (otherHasIt) {
    return {
      kind: 'photo',
      resolvedCategory: 'other',
      warning: known
        ? `Missing "${variant}" artwork for category "${category}" — using "other" artwork instead.`
        : `Unknown activity category "${category}" — using "other" artwork.`,
    };
  }

  return {
    kind: 'placeholder',
    warning: `No "${variant}" artwork installed yet for "${effectiveCategory}" (or "other") — using placeholder scene.`,
  };
}
