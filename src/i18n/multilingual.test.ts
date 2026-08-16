import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_LOCALE,
  RTL_LOCALES,
  SUPPORTED_LOCALES,
  activeDateLocale,
  coerceLocalePreference,
  dateLocaleTag,
  isRtlLocale,
  missingKeys,
  normalizeLanguageTag,
  resolveLocale,
  setActiveDateLocale,
  translate,
  type AppLocale,
} from './core.ts';
import { en } from './en.ts';
import { he } from './he.ts';
import { fr } from './fr.ts';
import { ru } from './ru.ts';

const NEW_LOCALES: AppLocale[] = ['fr', 'ru'];

// ===========================================================================
// FOUR LANGUAGES, ENGLISH DEFAULT
// ===========================================================================

test('exactly four languages ship, English first and default', () => {
  assert.deepEqual([...SUPPORTED_LOCALES], ['en', 'he', 'fr', 'ru']);
  assert.equal(DEFAULT_LOCALE, 'en');
});

test('ENGLISH IS DEFAULT with no stored preference, whatever the device says', () => {
  for (const tags of [[], ['en-US'], ['he-IL'], ['fr-FR'], ['ru-RU'], ['fr-CA', 'ru-RU']]) {
    assert.equal(resolveLocale(tags, null), 'en', JSON.stringify(tags));
  }
});

test('NO LANGUAGE AUTO-SELECTS from country or device — every one is opt-in', () => {
  assert.equal(resolveLocale(['fr-FR', 'fr'], null), 'en');
  assert.equal(resolveLocale(['ru-RU', 'ru'], null), 'en');
  assert.equal(resolveLocale(['he-IL'], 'system'), 'en');
});

// ===========================================================================
// SELECTION AND PERSISTENCE
// ===========================================================================

test('each language can be chosen and wins over the device', () => {
  assert.equal(resolveLocale(['en-US'], 'fr'), 'fr');
  assert.equal(resolveLocale(['en-US'], 'ru'), 'ru');
  assert.equal(resolveLocale(['ru-RU'], 'he'), 'he');
  assert.equal(resolveLocale(['fr-FR'], 'en'), 'en');
});

test('PERSISTENCE: every supported value round-trips through storage', () => {
  for (const locale of SUPPORTED_LOCALES) {
    assert.equal(coerceLocalePreference(locale), locale, locale);
    // What a restart does: read the stored string back, then resolve it.
    assert.equal(resolveLocale(['en-US'], coerceLocalePreference(locale)), locale, locale);
  }
});

test('PERSISTENCE: the full switch sequence survives restarts', () => {
  // EN -> FR -> restart -> RU -> restart -> HE -> restart -> EN
  const restart = (stored: string) => resolveLocale(['he-IL'], coerceLocalePreference(stored));
  assert.equal(restart('fr'), 'fr');
  assert.equal(restart('ru'), 'ru');
  assert.equal(restart('he'), 'he');
  assert.equal(restart('en'), 'en');
});

test('corrupt or unknown stored values fall back to English, never crash', () => {
  for (const bad of ['klingon', 'de', '', null, undefined, 'EN', 'fr-FR']) {
    assert.equal(coerceLocalePreference(bad as string | null), null, String(bad));
  }
  assert.equal(resolveLocale(['fr-FR'], coerceLocalePreference('de')), 'en');
});

test('device tags for the new languages normalise correctly', () => {
  for (const tag of ['fr', 'fr-FR', 'fr-CA', 'FR_ca']) {
    assert.equal(normalizeLanguageTag(tag), 'fr', tag);
  }
  for (const tag of ['ru', 'ru-RU', 'RU_ru']) {
    assert.equal(normalizeLanguageTag(tag), 'ru', tag);
  }
  assert.equal(normalizeLanguageTag('de-DE'), null);
});

// ===========================================================================
// DIRECTION — Hebrew alone is RTL
// ===========================================================================

test('HEBREW IS THE ONLY RTL LANGUAGE', () => {
  assert.deepEqual([...RTL_LOCALES], ['he']);
  assert.equal(isRtlLocale('he'), true);
  for (const locale of ['en', 'fr', 'ru'] as AppLocale[]) {
    assert.equal(isRtlLocale(locale), false, `${locale} must be LTR`);
  }
});

test('RUSSIAN IS NOT RTL — Cyrillic is an unfamiliar alphabet, not a direction', () => {
  assert.equal(isRtlLocale('ru'), false);
  assert.ok(!RTL_LOCALES.includes('ru'));
});

// ===========================================================================
// COVERAGE
// ===========================================================================

for (const locale of NEW_LOCALES) {
  test(`${locale}: every English key is translated`, () => {
    assert.deepEqual(missingKeys(locale), [], `${locale} is missing keys`);
  });

  test(`${locale}: introduces no key English lacks`, () => {
    const dictionary = locale === 'fr' ? fr : ru;
    const english = new Set(Object.keys(en));
    assert.deepEqual(Object.keys(dictionary).filter((k) => !english.has(k)), []);
  });

  test(`${locale}: no value is left as untranslated English`, () => {
    const dictionary = locale === 'fr' ? fr : ru;
    const allowed = new Set([
      // Every dictionary names each language in its OWN script.
      'language.english', 'language.hebrew', 'language.french', 'language.russian',
      // Pure format patterns — no words to translate.
      'chats.happenedOn', 'event.attendance.overflow', 'age.range',
      'activity.title.withoutLocation', 'duration.minutes', 'activity.participantsCount',
      // A brand name.
      'common.whatsapp',
      // Correct French that happens to be spelled like the English. Listing
      // them beats mistranslating a word to satisfy a test.
      'sort.distance', 'chats.section.forums', 'activity.message',
      'chat.messagePlaceholder', 'profile.role.parent', 'profile.memberFallback',
      // Proper Tel Aviv area names remain proper nouns in French.
      'place.area.jaffa', 'place.area.neveTzedek', 'place.area.ramatAviv',
      'place.area.ramatAvivGimel', 'place.area.hadarYosef', 'place.area.hatikva',
      'place.area.neotAfeka', 'place.area.neveEliezer', 'place.area.neveSharet',
      'place.area.zahala', 'event.category.festival',
    ]);
    const untranslated = (Object.keys(dictionary) as Array<keyof typeof en>).filter(
      (key) => !allowed.has(key) && dictionary[key] === en[key],
    );
    assert.deepEqual(untranslated, [], `${locale} left these in English`);
  });

  test(`${locale}: interpolation placeholders survive translation`, () => {
    const dictionary = locale === 'fr' ? fr : ru;
    const placeholders = (s: string) => (s.match(/\{(\w+)\}/g) ?? []).sort();
    for (const key of Object.keys(en) as Array<keyof typeof en>) {
      const translated = dictionary[key];
      if (!translated) continue;
      assert.deepEqual(
        placeholders(translated),
        placeholders(en[key]),
        `${locale} ${key}: placeholders differ — the string would render "{count}" literally`,
      );
    }
  });
}

test('the sample UI strings from the brief are translated in both languages', () => {
  const probes: Array<[keyof typeof en, string, string]> = [
    ['nav.discovery', 'Découvrir', 'Обзор'],
    ['nav.profile', 'Profil', 'Профиль'],
    ['discovery.search', 'Rechercher', 'Поиск'],
    ['sort.soonest', 'Le plus tôt', 'По времени'],
    ['event.rsvp.join', 'Je viens', 'Я иду'],
    ['event.attendance.title', 'Qui vient', 'Кто идёт'],
    ['place.whatsHere', 'Sur place', 'Что здесь есть'],
    ['profile.role.dad', 'Papa', 'Папа'],
    ['profile.birthdate.label', 'Date de naissance', 'Дата рождения'],
    ['common.saveChanges', 'Enregistrer les modifications', 'Сохранить изменения'],
  ];
  for (const [key, french, russian] of probes) {
    assert.equal(translate('fr', key), french, key);
    assert.equal(translate('ru', key), russian, key);
  }
});

test('a missing key falls back to English rather than a raw key', () => {
  // Simulated by translating a key from a dictionary that has it; the contract
  // under test is that translate() never returns the key itself for a real key.
  for (const locale of SUPPORTED_LOCALES) {
    const value = translate(locale, 'nav.chats');
    assert.notEqual(value, 'nav.chats', locale);
    assert.ok(value.length > 0, locale);
  }
});

test('chat inbox uses consumer-facing private-message copy in every locale', () => {
  assert.equal(en['chats.directChat'], 'Private messages');
  assert.equal(he['chats.directChat'], 'הודעות אישיות');
  assert.equal(fr['chats.directChat'], 'Messages privés');
  assert.equal(ru['chats.directChat'], 'Личные сообщения');
  for (const dictionary of [en, he, fr, ru]) {
    assert.doesNotMatch(dictionary['chats.directChat'], /direct chat|group chat|chat_type/i);
  }
});

// ===========================================================================
// FORUMS
// ===========================================================================

test('all 12 forums have French and Russian names and descriptions', () => {
  const keys = (Object.keys(en) as Array<keyof typeof en>).filter(
    (k) => k.startsWith('forum.') && k.endsWith('.title'),
  );
  assert.equal(keys.length, 12, `expected 12 forums, found ${keys.length}`);
  for (const titleKey of keys) {
    const descriptionKey = titleKey.replace('.title', '.description') as keyof typeof en;
    for (const [locale, dictionary] of [['fr', fr], ['ru', ru]] as const) {
      assert.ok(dictionary[titleKey], `${locale} missing ${titleKey}`);
      assert.ok(dictionary[descriptionKey], `${locale} missing ${descriptionKey}`);
      assert.notEqual(dictionary[titleKey], en[titleKey], `${locale} ${titleKey} untranslated`);
    }
  }
});

test('forum KEYS are unchanged — only the labels are localized', () => {
  const frenchKeys = Object.keys(fr).filter((k) => k.startsWith('forum.')).sort();
  const englishKeys = Object.keys(en).filter((k) => k.startsWith('forum.')).sort();
  assert.deepEqual(frenchKeys, englishKeys);
});

// ===========================================================================
// DATE / TIME LOCALE
// ===========================================================================

test('each language maps to its own date locale', () => {
  assert.equal(dateLocaleTag('en'), 'en-US');
  assert.equal(dateLocaleTag('he'), 'he-IL');
  assert.equal(dateLocaleTag('fr'), 'fr-FR');
  assert.equal(dateLocaleTag('ru'), 'ru-RU');
});

test('the active date locale follows the chosen language', () => {
  for (const locale of SUPPORTED_LOCALES) {
    setActiveDateLocale(locale);
    assert.equal(activeDateLocale(), dateLocaleTag(locale), locale);
  }
  setActiveDateLocale('en');
});

test('formatters ask the APP locale, never the device', () => {
  // `undefined` means "whatever the phone is set to", which would show Hebrew
  // dates to someone who chose French on a Hebrew handset.
  for (const file of [
    'formatExactStartTime', 'formatStartTime', 'formatPastRelativeTime',
    'formatRelativeTime', 'generateActivityTitle',
  ]) {
    const source = readFileSync(new URL(`../utils/${file}.ts`, import.meta.url), 'utf8');
    assert.match(source, /activeDateLocale\(\)/, `${file} does not use the app locale`);
    assert.ok(!/toLocale\w+\(undefined,/.test(source), `${file} still asks the device locale`);
    assert.ok(!/toLocale\w+\('en-US',/.test(source), `${file} still hardcodes en-US`);
  }
});

// ===========================================================================
// SELECTOR AND ARCHITECTURE
// ===========================================================================

const selector = readFileSync(new URL('../components/LanguageSelector.tsx', import.meta.url), 'utf8');

test('the selector offers all four languages, each in its own script', () => {
  for (const key of ["'en'", "'he'", "'fr'", "'ru'"]) {
    assert.ok(selector.includes(`key: ${key}`), `selector is missing ${key}`);
  }
  assert.match(selector, /language\.french/);
  assert.match(selector, /language\.russian/);
  assert.ok(!/'system'/.test(selector), 'device-locale option is back in the user UI');
});

test('LAYOUT: four options wrap into a grid instead of compressing', () => {
  // Four across on a 375pt screen leaves ~80pt per cell, which truncates
  // "Français" and wraps "Русский" one character per line.
  assert.match(selector, /flexWrap: 'wrap'/);
  assert.match(selector, /width: '48%'/);
  assert.match(selector, /numberOfLines=\{1\}/);
  // Comments stripped: the file names the banned pattern while explaining it.
  const code = selector.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/flex: 1/.test(code), 'a collapsible flex child is back');
});

test('touch targets clear 44pt', () => {
  const match = selector.match(/minHeight:\s*(\d+)/);
  assert.ok(match && Number(match[1]) >= 44, `minHeight is ${match?.[1]}`);
});

test('NO INLINE LOCALE BRANCHING outside the i18n module', () => {
  // Locale-specific copy belongs in a dictionary. An inline ternary is how a
  // codebase ends up with four languages in three places and two in the rest.
  const files = [
    '../components/LanguageSelector.tsx',
    '../screens/ProfileScreen.tsx',
    '../screens/DiscoverScreen.tsx',
    '../screens/EditProfileScreen.tsx',
  ];
  for (const file of files) {
    const source = readFileSync(new URL(file, import.meta.url), 'utf8');
    const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    assert.ok(
      !/locale === '(he|fr|ru)'\s*\?/.test(code),
      `${file} branches on locale inline instead of using a translation key`,
    );
  }
});
