import { en, type Dictionary, type TranslationKey } from './en';
import { he } from './he';
import { fr } from './fr';
import { ru } from './ru';

export type AppLocale = 'en' | 'he' | 'fr' | 'ru';
/** What the user actually chose. `system` means "follow the device", and is
 *  persisted distinctly from `en`/`he` so that a user who never made a choice
 *  keeps tracking their device when they change it. */
export type LocalePreference = AppLocale | 'system';

export const SUPPORTED_LOCALES: readonly AppLocale[] = ['en', 'he', 'fr', 'ru'];
export const DEFAULT_LOCALE: AppLocale = 'en';
/** RTL is a property of the language, not of the device, and not of the
 *  alphabet being unfamiliar. Hebrew is the only RTL language NestUp ships:
 *  French is Latin and Russian is Cyrillic, and BOTH are left-to-right. */
export const RTL_LOCALES: readonly AppLocale[] = ['he'];

const DICTIONARIES: Record<AppLocale, Dictionary> = { en, he, fr, ru };

/** BCP-47 tag for locale-aware date and number formatting.
 *
 *  Kept next to the dictionaries so a new language cannot be added with
 *  translated copy but English dates. Callers pass this into the existing
 *  `toLocaleDateString`/`toLocaleTimeString` calls; no date logic changes. */
const DATE_LOCALE_TAG: Record<AppLocale, string> = {
  en: 'en-US',
  he: 'he-IL',
  fr: 'fr-FR',
  ru: 'ru-RU',
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

export function setActiveDateLocale(locale: AppLocale): void {
  activeDateLocaleTag = dateLocaleTag(locale);
}

export function activeDateLocale(): string {
  return activeDateLocaleTag;
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
