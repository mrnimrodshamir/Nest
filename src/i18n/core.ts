import { en, type Dictionary, type TranslationKey } from './en';
import { he } from './he';
import { fr } from './fr';
import { ru } from './ru';
import { ar } from './ar';
import { es } from './es';

export type AppLocale = 'en' | 'he' | 'fr' | 'ru' | 'ar' | 'es';
/** What the user actually chose. `system` means "follow the device", and is
 *  persisted distinctly from `en`/`he` so that a user who never made a choice
 *  keeps tracking their device when they change it. */
export type LocalePreference = AppLocale | 'system';

export const SUPPORTED_LOCALES: readonly AppLocale[] = ['en', 'he', 'fr', 'ru', 'ar', 'es'];
export const DEFAULT_LOCALE: AppLocale = 'en';
/** RTL is a property of the language, not of the device, and not of the
 *  alphabet being unfamiliar. Hebrew and Arabic are the only RTL languages
 *  NestUp ships: French, Russian and Spanish are all left-to-right. */
export const RTL_LOCALES: readonly AppLocale[] = ['he', 'ar'];

const DICTIONARIES: Record<AppLocale, Dictionary> = { en, he, fr, ru, ar, es };

/** BCP-47 tag for locale-aware date and number formatting.
 *
 *  Kept next to the dictionaries so a new language cannot be added with
 *  translated copy but English dates. Callers pass this into the existing
 *  `toLocaleDateString`/`toLocaleTimeString` calls; no date logic changes.
 *
 *  Arabic deliberately maps to `ar-EG`, not `ar-SA`: ICU's Saudi locale
 *  defaults to the Umm al-Qura (Hijri) calendar, which would print activity
 *  dates in the wrong calendar system for a Gregorian-dates app. `ar-EG` is
 *  Gregorian by default and still reads as natural Arabic digits/punctuation. */
const DATE_LOCALE_TAG: Record<AppLocale, string> = {
  en: 'en-US',
  he: 'he-IL',
  fr: 'fr-FR',
  ru: 'ru-RU',
  ar: 'ar-EG',
  es: 'es-ES',
};

export function dateLocaleTag(locale: AppLocale): string {
  return DATE_LOCALE_TAG[locale] ?? DATE_LOCALE_TAG[DEFAULT_LOCALE];
}

/** The tag the date formatters should use right now.
 *
 *  A module-level value rather than a parameter threaded through every call
 *  site: the formatters are pure string helpers called from dozens of
 *  components, and giving each one a locale argument would mean touching all of
 *  them — a much larger change than adding two languages. I18nProvider sets
 *  this whenever the locale changes, and the formatters read it instead of
 *  passing `undefined` (which asks the DEVICE, not the app, and so would show
 *  Hebrew dates to someone who chose French). */
let activeDateLocaleTag: string = DATE_LOCALE_TAG[DEFAULT_LOCALE];
let activeAppLocale: AppLocale = DEFAULT_LOCALE;

export function setActiveDateLocale(locale: AppLocale): void {
  activeAppLocale = locale;
  activeDateLocaleTag = dateLocaleTag(locale);
}

export function activeDateLocale(): string {
  return activeDateLocaleTag;
}

export function currentAppLocale(): AppLocale {
  return activeAppLocale;
}

export function isRtlLocale(locale: AppLocale): boolean {
  return RTL_LOCALES.includes(locale);
}

/** Maps a BCP-47 tag from the OS onto a locale we actually ship.
 *  Accepts `he`, `he-IL`, `HE_il`, and the legacy `iw` code Android still
 *  emits for Hebrew. Anything unsupported returns null so the caller can fall
 *  back rather than render a half-translated UI. */
export function normalizeLanguageTag(tag: string | null | undefined): AppLocale | null {
  if (!tag) return null;
  const primary = tag.trim().toLowerCase().replace(/_/g, '-').split('-')[0];
  if (!primary) return null;
  // `iw` is the deprecated ISO code for Hebrew; some Android builds still send it.
  if (primary === 'he' || primary === 'iw') return 'he';
  if (primary === 'en') return 'en';
  if (primary === 'fr') return 'fr';
  if (primary === 'ru') return 'ru';
  if (primary === 'ar') return 'ar';
  if (primary === 'es') return 'es';
  return null;
}

/** Resolves the locale to actually render in.
 *
 *  A stored `en`/`he` preference always wins — an explicit choice must survive
 *  the user later changing their device language. Only `system` (or no stored
 *  value at all) consults the device tags, taking the first supported one. */
export function resolveLocale(
  deviceTags: readonly (string | null | undefined)[],
  storedPreference: LocalePreference | null | undefined,
): AppLocale {
  if (storedPreference && storedPreference !== 'system' && SUPPORTED_LOCALES.includes(storedPreference)) {
    return storedPreference;
  }

  // EVERY LANGUAGE IS OPT-IN. A user in Israel on a Hebrew device, or in Paris
  // on a French one, still opens the app in English until they choose
  // otherwise. Auto-switching on device language surprised testers who wanted
  // English, and the product decision is that English is the default for
  // everyone — adding French and Russian does not change that.
  //
  // `system` is kept only so previously stored values coerce safely; it no
  // longer consults the device, and the selector no longer offers it.
  void deviceTags;
  return DEFAULT_LOCALE;
}

/** Only a supported locale or the legacy `system` may be persisted; anything
 *  else (corrupt storage, a value written by an older build) is treated as
 *  "no preference". Driven off SUPPORTED_LOCALES so adding a language cannot
 *  leave a value that saves but never loads. */
export function coerceLocalePreference(value: string | null | undefined): LocalePreference | null {
  if (value === 'system') return 'system';
  return SUPPORTED_LOCALES.includes(value as AppLocale) ? (value as AppLocale) : null;
}

export type TranslateParams = Readonly<Record<string, string | number>>;

/** Looks up `key`, falling back to English, then to the key itself.
 *
 *  Returning the key rather than an empty string is deliberate: a missing
 *  translation shows up loudly in QA instead of silently collapsing a layout. */
export function translate(locale: AppLocale, key: TranslationKey, params?: TranslateParams): string {
  const raw = DICTIONARIES[locale]?.[key] ?? en[key] ?? key;
  return params ? interpolate(raw, params) : raw;
}

/** Replaces `{name}` placeholders. An unknown placeholder is left intact so a
 *  copy mistake is visible rather than producing the string "undefined". */
export function interpolate(template: string, params: TranslateParams): string {
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    Object.prototype.hasOwnProperty.call(params, name) ? String(params[name]) : match,
  );
}

/** Every key missing from a locale. Used by a test to keep the gap explicit
 *  rather than letting Hebrew silently rot as English keys are added. */
export function missingKeys(locale: AppLocale): TranslationKey[] {
  const dictionary = DICTIONARIES[locale];
  return (Object.keys(en) as TranslationKey[]).filter((key) => dictionary[key] === undefined);
}
