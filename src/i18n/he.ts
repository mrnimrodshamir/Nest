import type { Dictionary } from './en';

/** Hebrew. Typed as a partial dictionary on purpose: anything not translated
 *  yet falls back to English at runtime, so shipping a partial Hebrew build
 *  degrades to readable English rather than to a raw key. */
export const he: Dictionary = {
  // --- Language selector -------------------------------------------------
  'language.title': 'שפה',
  'language.english': 'English',
  'language.hebrew': 'עברית',
  'language.system': 'לפי המכשיר',
  'language.systemHint': 'השתמש בשפת המכשיר',
  'language.restartHint': 'הפעילו מחדש את NestUp כדי להשלים את שינוי כיוון התצוגה.',

  // --- Navigation --------------------------------------------------------
  'nav.discovery': 'גילוי',
  'nav.chats': 'צ׳אטים',
  'nav.myActivities': 'הפעילויות שלי',
  'nav.profile': 'פרופיל',

  // --- Discovery ---------------------------------------------------------
  'discovery.search': 'חיפוש',
  'discovery.searchPlaceholder': 'חיפוש פעילויות, מקומות ואירועים',
  'discovery.closeSearch': 'סגירת החיפוש',
  'discovery.filters': 'סינון',
  'discovery.sort': 'מיון',
  'discovery.activities': 'פעילויות',
  'discovery.places': 'מקומות',
  'discovery.events': 'אירועים',
  'discovery.loading': 'טוען…',
  'discovery.retry': 'נסו שוב',
  'discovery.clearFilters': 'ניקוי הסינון',
  'discovery.expandArea': 'חיפוש באזור רחב יותר',
  'discovery.hostActivity': 'יצירת פעילות',
  'discovery.map': 'מפה',
  'discovery.list': 'רשימה',

  'discovery.empty.all': 'לא נמצאו פעילויות, מקומות או אירועים באזור הזה.',
  'discovery.empty.activities': 'אין פעילויות שמתאימות לסינון הזה.',
  'discovery.empty.places': 'אין מקומות שמתאימים לסינון הזה.',
  'discovery.empty.events': 'אין אירועים שמתאימים לסינון הזה.',

  'discovery.error.activities': 'לא הצלחנו לטעון פעילויות.',
  'discovery.error.places': 'לא הצלחנו לטעון מקומות.',
  'discovery.error.events': 'לא הצלחנו לטעון אירועים.',

  // --- Filters -----------------------------------------------------------
  'filters.title': 'סינון',
  'filters.content': 'תוכן',
  'filters.reset': 'איפוס',
  'filters.resetAll': 'איפוס הכול',
  'filters.apply': 'החלה',
  'filters.activeCount': '{count} פעילים',
  'filters.keepOneType': 'יש להשאיר לפחות סוג תוכן אחד מסומן.',

  // --- Sort --------------------------------------------------------------
  'sort.title': 'מיון',
  'sort.default': 'מומלץ',
  'sort.distance': 'מרחק',
  'sort.soonest': 'הקרוב ביותר',
  'sort.alphabetical': 'לפי א״ב',

  // --- Common actions ----------------------------------------------------
  'common.share': 'שיתוף',
  'common.addToCalendar': 'הוספה ליומן',
  'common.openMaps': 'פתיחה במפות',
  'common.createActivity': 'יצירת פעילות',
  'common.viewActivity': 'צפייה בפעילות',
  'common.viewPlace': 'צפייה במקום',
  'common.viewEvent': 'צפייה באירוע',
  'common.editProfile': 'עריכת פרופיל',
  'common.back': 'חזרה',
  'common.cancel': 'ביטול',
  'common.save': 'שמירה',
  'common.done': 'סיום',

  // --- Profile -----------------------------------------------------------
  'profile.role.mom': 'אמא',
  'profile.role.dad': 'אבא',
  'profile.role.parent': 'הורה',
  'profile.role.label': 'אני',
  'profile.role.hint': 'מוצג בפרופיל הציבורי שלכם. אפשר להשאיר ריק.',
  'profile.children': 'ילדים',
  'profile.neighborhood': 'שכונה',
  'profile.occupation': 'עיסוק',
  'profile.bio': 'קצת עליי',
  'profile.memberSince': 'חבר/ה מאז {date}',
  'profile.roleOfCount': '{role} ל־{count}',
};
