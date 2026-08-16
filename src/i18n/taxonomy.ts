import type { ActivityCategory } from '@/types/activity';
import type { PlaceCategory } from '@/types/familyFriendlyPlace';
import type { TranslateParams } from './core';
import type { TranslationKey } from './en';

export type Translator = (key: TranslationKey, params?: TranslateParams) => string;

export function activityCategoryLabel(category: ActivityCategory, t: Translator): string {
  return t(`activity.category.${category}` as TranslationKey);
}

export function placeCategoryLabel(category: PlaceCategory, t: Translator): string {
  return t(`place.category.${category}` as TranslationKey);
}

/** Only app-owned area taxonomy is translated. Provider place names and
 * free-form neighborhoods remain exactly as supplied by the source. */
export function localizedPlaceArea(area: string | null, t: Translator): string | null {
  if (!area) return null;
  return area.trim().toLocaleLowerCase('en-US') === 'city center'
    ? t('place.area.cityCenter')
    : area;
}
