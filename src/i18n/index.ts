export { en, type TranslationKey, type Dictionary } from './en';
export { he } from './he';
export { ar } from './ar';
export { es } from './es';
export {
  SUPPORTED_LOCALES,
  DEFAULT_LOCALE,
  RTL_LOCALES,
  isRtlLocale,
  normalizeLanguageTag,
  resolveLocale,
  coerceLocalePreference,
  translate,
  interpolate,
  dateLocaleTag,
  currentAppLocale,
  missingKeys,
  type AppLocale,
  type LocalePreference,
  type TranslateParams,
} from './core';
export {
  detectTextDirection,
  textAlignForContent,
  isolateText,
  isBidirectional,
  physicalEdge,
  directionalIconRotation,
  type TextDirection,
} from './rtl';
export { I18nProvider, useI18n, useTranslation, LOCALE_STORAGE_KEY } from './I18nProvider';
export { activityCategoryLabel, placeCategoryLabel, eventCategoryLabel, localizedPlaceArea, localizedPlaceName, type Translator } from './taxonomy';
