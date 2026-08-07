/** The English dictionary is the source of truth: every key that exists in the
 *  app exists here, and `TranslationKey` is derived from it. A Hebrew entry can
 *  therefore never introduce a key English doesn't have, and a missing Hebrew
 *  entry falls back to the English string rather than rendering a raw key. */
export const en = {
  // --- Language selector -------------------------------------------------
  'language.title': 'Language',
  'language.english': 'English',
  'language.hebrew': 'עברית',
  'language.system': 'Match device',
  'language.systemHint': 'Follow your device language',
  'language.restartHint': 'Restart NestUp to finish switching the layout direction.',

  // --- Navigation --------------------------------------------------------
  'nav.discovery': 'Discovery',
  'nav.chats': 'Chats',
  'nav.myActivities': 'My Activities',
  'nav.profile': 'Profile',

  // --- Discovery ---------------------------------------------------------
  'discovery.search': 'Search',
  'discovery.searchPlaceholder': 'Search activities, places and events',
  'discovery.closeSearch': 'Close search',
  'discovery.filters': 'Filters',
  'discovery.sort': 'Sort',
  'discovery.activities': 'Activities',
  'discovery.places': 'Places',
  'discovery.events': 'Events',
  'discovery.loading': 'Loading…',
  'discovery.retry': 'Try again',
  'discovery.clearFilters': 'Clear filters',
  'discovery.expandArea': 'Search a wider area',
  'discovery.hostActivity': 'Host an activity',
  'discovery.map': 'Map',
  'discovery.list': 'List',

  // Empty states, one per content combination.
  'discovery.empty.all': 'No activities, places, or events found in this area.',
  'discovery.empty.activities': 'No activities match these filters.',
  'discovery.empty.places': 'No places match these filters.',
  'discovery.empty.events': 'No events match these filters.',

  // Partial-failure banners.
  'discovery.error.activities': "Couldn't load activities.",
  'discovery.error.places': "Couldn't load places.",
  'discovery.error.events': "Couldn't load events.",

  // --- Filters -----------------------------------------------------------
  'filters.title': 'Filters',
  'filters.content': 'Content',
  'filters.reset': 'Reset',
  'filters.resetAll': 'Reset all',
  'filters.apply': 'Apply',
  'filters.activeCount': '{count} active',
  'filters.keepOneType': 'Keep at least one content type selected.',

  // --- Sort --------------------------------------------------------------
  'sort.title': 'Sort',
  'sort.default': 'Recommended',
  'sort.distance': 'Distance',
  'sort.soonest': 'Soonest',
  'sort.alphabetical': 'Alphabetical',

  // --- Common actions ----------------------------------------------------
  'common.share': 'Share',
  'common.addToCalendar': 'Add to Calendar',
  'common.openMaps': 'Open in Maps',
  'common.createActivity': 'Create Activity',
  'common.viewActivity': 'View Activity',
  'common.viewPlace': 'View Place',
  'common.viewEvent': 'View Event',
  'common.editProfile': 'Edit Profile',
  'common.back': 'Back',
  'common.cancel': 'Cancel',
  'common.save': 'Save',
  'common.done': 'Done',

  // --- Profile -----------------------------------------------------------
  'profile.role.mom': 'Mom',
  'profile.role.dad': 'Dad',
  'profile.role.parent': 'Parent',
  'profile.role.label': 'I am a',
  'profile.role.hint': 'Shown on your public profile. You can leave this blank.',
  'profile.children': 'Children',
  'profile.neighborhood': 'Neighborhood',
  'profile.occupation': 'Occupation',
  'profile.bio': 'About',
  'profile.memberSince': 'Member since {date}',
  /** "Mom of 2" — the noun is already localized before it reaches this. */
  'profile.roleOfCount': '{role} of {count}',
} as const;

export type TranslationKey = keyof typeof en;
export type Dictionary = Readonly<Partial<Record<TranslationKey, string>>>;
