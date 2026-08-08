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

  'discovery.contentTypes': 'סוגי תוכן',
  'discovery.selectAll': 'בחירת הכול',
  'discovery.sortListTitle': 'מיון הרשימה',
  'discovery.sortHint': 'המיון משנה את הרשימה בלבד. הסימונים במפה נשארים במקומם.',
  'discovery.swipeUp': 'החליקו למעלה לגילוי',
  'discovery.finding': 'מחפשים אפשרויות באזור…',
  'discovery.searchThisArea': 'חיפוש באזור הזה',

  'discovery.count.activities.one': 'פעילות אחת בסביבה',
  'discovery.count.activities.other': '{count} פעילויות בסביבה',
  'discovery.count.places.one': 'מקום אחד באזור',
  'discovery.count.places.other': '{count} מקומות באזור',
  'discovery.count.events.one': 'אירוע אחד באזור',
  'discovery.count.events.other': '{count} אירועים באזור',
  'discovery.count.mixed': '{count} בסביבה',

  'discovery.empty.all': 'שום דבר באזור לא מתאים לסינון שלכם עדיין.',
  'discovery.empty.activities': 'אין פעילויות שמתאימות לסינון שלכם.',
  'discovery.empty.places': 'אין מקומות שמתאימים לסינון שלכם.',
  'discovery.empty.events': 'אין אירועים שמתאימים לסינון שלכם.',
  'discovery.empty.activitiesPlaces': 'אין פעילויות או מקומות שמתאימים לסינון שלכם.',
  'discovery.empty.activitiesEvents': 'אין פעילויות או אירועים שמתאימים לסינון שלכם.',
  'discovery.empty.placesEvents': 'אין מקומות או אירועים שמתאימים לסינון שלכם.',
  'discovery.empty.body': 'נסו להזיז את המפה, לשנות סינון או לחפש בסביבה.',
  'discovery.empty.bodyLocationOff': 'הגישה למיקום כבויה, ולכן ייתכן שהאזור הזה אינו קרוב אליכם.',

  'discovery.error.activities': 'לא הצלחנו לרענן פעילויות',
  'discovery.error.places': 'לא הצלחנו לרענן מקומות',
  'discovery.error.events': 'לא הצלחנו לרענן אירועים',

  // --- Filters -----------------------------------------------------------
  'filters.title': 'סינון',
  'filters.content': 'תוכן',
  'filters.reset': 'איפוס',
  'filters.resetAll': 'איפוס הכול',
  'filters.apply': 'החלה',
  'filters.activeCount': '{count} פעילים',
  'filters.keepOneType': 'יש להשאיר לפחות סוג תוכן אחד מסומן.',
  'filters.showType': 'הצגת {type}',
  'filters.withCount': 'סינון · {count}',

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
  'common.close': 'סגירת {what}',
  'common.retry': 'נסו שוב',
  'common.retryLabel': '{label}. נסו שוב',

  // --- Profile -----------------------------------------------------------
  'profile.role.mom': 'אמא',
  'profile.role.dad': 'אבא',
  'profile.role.parent': 'הורה',
  'profile.role.label': 'אני',
  'profile.role.hint': 'מוצג בפרופיל הציבורי שלכם. אפשר להשאיר ריק.',
  'profile.children': 'ילדים',
  'profile.editProfileAndChildren': 'עריכת פרופיל וילדים',
  'profile.notificationSettings': 'הגדרות התראות',
  'profile.blockedMembers': 'משתמשים חסומים',
  'profile.terms': 'תנאי שימוש',
  'profile.privacy': 'מדיניות פרטיות',
  'profile.signOut': 'התנתקות',
  'profile.signOutConfirm': 'להתנתק?',
  'profile.neighborhood': 'שכונה',
  'profile.occupation': 'עיסוק',
  'profile.bio': 'קצת עליי',
  'profile.memberSince': 'חבר/ה מאז {date}',
  'profile.roleOfCount': '{role} ל־{count}',
};
