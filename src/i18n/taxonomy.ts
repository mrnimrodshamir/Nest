import type { ActivityCategory } from '@/types/activity';
import type { PlaceCategory } from '@/types/familyFriendlyPlace';
import type { EventCategory } from '@/types/event';
import type { AppLocale } from './core';
import type { TranslateParams } from './core';
import type { TranslationKey } from './en';

export type Translator = (key: TranslationKey, params?: TranslateParams) => string;

export function activityCategoryLabel(category: ActivityCategory, t: Translator): string {
  return t(`activity.category.${category}` as TranslationKey);
}

export function placeCategoryLabel(category: PlaceCategory, t: Translator): string {
  return t(`place.category.${category}` as TranslationKey);
}

export function eventCategoryLabel(category: EventCategory | null, t: Translator): string {
  return category ? t(`event.category.${category}` as TranslationKey) : t('event.category.event');
}

const HEBREW_PLACE_NAMES: Readonly<Record<string, string>> = {
  'nordau-separate-beach': 'החוף הנפרד נורדאו',
  'bograshov-beach': 'חוף בוגרשוב',
  'beit-ariela-public-library': 'ספריית בית אריאלה',
  'chess-center-sissy-and-marc-sol-library': 'מרכז השחמט וספריית סיסי ומארק סול',
  'sherman-library': 'ספריית שרמן',
  'felicia-blumenthal-music-center-and-library': 'מרכז המוזיקה והספרייה ע״ש פליציה בלומנטל',
  'beit-danni-library': 'ספריית בית דני',
  'bat-zion-library': 'ספריית בת ציון',
  'hadar-yosef-library': 'ספריית הדר יוסף',
  'anna-laura-petlik-fischer-library': 'ספריית אנה לורה פטליק פישר',
  'yad-lebanim-library': 'ספריית יד לבנים',
  'jaffa-gimel-library': 'ספריית יפו ג׳',
  'mandel-library-and-culture-center': 'ספריית ומרכז תרבות מנדל',
  'neve-eliezer-library': 'ספריית נווה אליעזר',
  'ramat-aviv-gimel-library': 'ספריית רמת אביב ג׳',
  'anu-museum-of-the-jewish-people': 'אנו – מוזיאון העם היהודי',
  'steinhardt-museum-of-natural-history': 'מוזיאון הטבע ע״ש שטיינהרדט',
  'nahum-gutman-museum-of-art': 'מוזיאון נחום גוטמן לאמנות',
  'ilana-goor-museum': 'מוזיאון אילנה גור',
  'tel-aviv-port-promenade': 'נמל תל אביב',
  'yarkon-park': 'פארק הירקון – גני יהושע',
  'menachem-begin-park-south-park': 'פארק מנחם בגין',
  'charles-clore-park': 'פארק צ׳ארלס קלור',
  'independence-park': 'פארק העצמאות',
  'meir-garden': 'גן מאיר',
  'hapisga-garden': 'גן הפסגה',
  'gordon-pool': 'בריכת גורדון',
  'neve-sharet-country-and-community-center': 'הקאנטרי הקהילתי נווה שרת',
  'neot-afeka-community-country': 'הקאנטרי הקהילתי נאות אפקה',
  'zahala-community-country': 'הקאנטרי הקהילתי צהלה',
  'hilton-beach': 'חוף הילטון',
  'metzitzim-beach': 'חוף מציצים',
  'gordon-beach': 'חוף גורדון',
  'frishman-beach': 'חוף פרישמן',
  'jerusalem-beach': 'חוף ירושלים',
  'tel-aviv-museum-of-art': 'מוזיאון תל אביב לאמנות',
};

/** Real Tel Aviv places only. The generic "dropped a pin" placeholder used to
 *  live here, which meant it was localized for Hebrew and left in English for
 *  French, Russian and every language added later. It is a UI string, not a
 *  place, and now resolves through `locationPicker.meetingPoint` for all
 *  locales — see genericPlaceName. */
const HEBREW_PLACE_NAMES_BY_ENGLISH: Readonly<Record<string, string>> = {
  'independence park': 'פארק העצמאות',
  'gordon swimming pool': 'בריכת גורדון',
  'gordon pool': 'בריכת גורדון',
  'hilton beach': 'חוף הילטון',
  'meir park': 'גן מאיר',
  'tel aviv museum of art': 'מוזיאון תל אביב לאמנות',
  'beit ariela public library': 'ספריית בית אריאלה',
  'ganei yehoshua (yarkon park)': 'פארק הירקון – גני יהושע',
  'hayarkon park': 'פארק הירקון',
  'tel aviv port': 'נמל תל אביב',
};

export function localizedPlaceName(
  place: { slug?: string | null; name: string },
  locale: AppLocale,
): string {
  if (locale !== 'he') return place.name;
  return (place.slug && HEBREW_PLACE_NAMES[place.slug])
    || HEBREW_PLACE_NAMES_BY_ENGLISH[place.name.trim().toLocaleLowerCase('en-US')]
    || place.name;
}

/** Only app-owned area taxonomy is translated. Provider place names and
 * free-form neighborhoods remain exactly as supplied by the source. */
export function localizedPlaceArea(area: string | null, t: Translator): string | null {
  if (!area) return null;
  const key = area.trim().toLocaleLowerCase('en-US').replace(/\s*\/\s*/g, '/');
  const areaKeys: Record<string, TranslationKey> = {
    'city center': 'place.area.cityCenter',
    'old north': 'place.area.oldNorth',
    'north tel aviv': 'place.area.northTelAviv',
    'old jaffa': 'place.area.oldJaffa',
    'jaffa': 'place.area.jaffa',
    'neve tzedek': 'place.area.neveTzedek',
    'neve tzedek/coast': 'place.area.neveTzedekCoast',
    'ramat aviv': 'place.area.ramatAviv',
    'ramat aviv gimel': 'place.area.ramatAvivGimel',
    'hadar yosef': 'place.area.hadarYosef',
    'hatikva': 'place.area.hatikva',
    'neot afeka': 'place.area.neotAfeka',
    'neve eliezer': 'place.area.neveEliezer',
    'neve sharet': 'place.area.neveSharet',
    'shapira/south tel aviv': 'place.area.shapiraSouth',
    'southeast tel aviv': 'place.area.southeast',
    'zahala': 'place.area.zahala',
  };
  return areaKeys[key] ? t(areaKeys[key]) : area;
}
