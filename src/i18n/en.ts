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

  'discovery.contentTypes': 'Content types',
  'discovery.selectAll': 'Select all',
  'discovery.sortListTitle': 'Sort list',
  'discovery.sortHint': 'Sorting changes the list only. Map markers stay in place.',
  'discovery.swipeUp': 'Swipe up to explore',
  'discovery.finding': 'Finding nearby options…',
  'discovery.searchThisArea': 'Search this area',

  // Result counts. one/other are separate keys rather than an inline ternary
  // because Hebrew pluralizes differently from English.
  'discovery.count.activities.one': '1 activity nearby',
  'discovery.count.activities.other': '{count} activities nearby',
  'discovery.count.places.one': '1 place in this area',
  'discovery.count.places.other': '{count} places in this area',
  'discovery.count.events.one': '1 event in this area',
  'discovery.count.events.other': '{count} events in this area',
  'discovery.count.mixed': '{count} nearby',

  // Empty states — one per content combination, so mixed selections read
  // naturally instead of falling back to a generic catch-all.
  'discovery.empty.all': 'Nothing nearby matches your filters yet.',
  'discovery.empty.activities': 'No activities match your filters.',
  'discovery.empty.places': 'No places match your filters.',
  'discovery.empty.events': 'No events match your filters.',
  'discovery.empty.activitiesPlaces': 'No activities or places match your filters.',
  'discovery.empty.activitiesEvents': 'No activities or events match your filters.',
  'discovery.empty.placesEvents': 'No places or events match your filters.',
  'discovery.empty.body': 'Try moving the map, changing a filter, or searching nearby.',
  'discovery.empty.bodyLocationOff': 'Location access is off, so this area may not be near you.',

  // Partial-failure banners.
  'discovery.error.activities': "Activities couldn't refresh",
  'discovery.error.places': "Places couldn't refresh",
  'discovery.error.events': "Events couldn't refresh",

  // --- Filters -----------------------------------------------------------
  'filters.title': 'Filters',
  'filters.content': 'Content',
  'filters.reset': 'Reset',
  'filters.resetAll': 'Reset all',
  'filters.apply': 'Apply',
  'filters.activeCount': '{count} active',
  'filters.keepOneType': 'Keep at least one content type selected.',
  /** Accessibility label for a content-type checkbox. */
  'filters.showType': 'Show {type}',
  'filters.withCount': 'Filters · {count}',

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
  'common.close': 'Close {what}',
  'common.retry': 'Try again',
  'common.retryLabel': '{label}. Try again',

  // --- Chats sections ----------------------------------------------------
  'chats.section.active': 'Chats',
  'chats.section.past': 'Past Chats',
  'chats.section.forums': 'Forums',
  'chats.empty.active': 'No active chats yet.',
  'chats.empty.past': 'Past activity chats will appear here.',
  'chats.empty.activeBody': 'Join or host an activity to start talking.',
  'chats.empty.pastBody': 'Once an activity is over, its chat moves here.',
  'chats.error.forums': "Couldn't load forums.",
  'chats.error.load': "Couldn't load your messages.",
  'chats.noMessagesYet': 'Say hello 👋',
  'chats.you': 'You',
  /** Past activity chats read "Aug 7 · 10:00" — the date the activity happened. */
  'chats.happenedOn': '{date} · {time}',
  'chats.directChat': 'Direct chat',
  'chats.activityChat': 'Activity chat',

  // --- Forums ------------------------------------------------------------
  'forum.communitySpace': 'Community',
  'forum.tel-aviv-moms.title': 'Tel Aviv Moms',
  'forum.tel-aviv-moms.description': 'Local questions, meetups and recommendations',
  'forum.tel-aviv-dads.title': 'Tel Aviv Dads',
  'forum.tel-aviv-dads.description': 'Dads sharing plans, questions and local tips',
  'forum.breastfeeding.title': 'Breastfeeding',
  'forum.breastfeeding.description': 'Feeding, pumping and breastfeeding support',
  'forum.child-development.title': 'Child Development',
  'forum.child-development.description': 'Milestones, development and everyday questions',
  'forum.parental-leave.title': 'Parents on Parental Leave',
  'forum.parental-leave.description': 'Daytime company, routines and going back to work',
  'forum.baby-sleep.title': 'Baby Sleep',
  'forum.baby-sleep.description': 'Naps, nights and what worked for other parents',
  'forum.starting-solids.title': 'Starting Solids & Baby Nutrition',
  'forum.starting-solids.description': 'First foods, allergies and mealtime ideas',
  'forum.things-to-do-tel-aviv.title': 'Things to Do with Kids in Tel Aviv',
  'forum.things-to-do-tel-aviv.description': 'Places, events and local ideas',
  'forum.local-recommendations.title': 'Local Recommendations',
  'forum.local-recommendations.description': 'Clinics, classes, shops and trusted services',
  'forum.pregnancy-postpartum.title': 'Pregnancy & Postpartum',
  'forum.pregnancy-postpartum.description': 'Expecting, birth and the first months after',

  // --- Profile -----------------------------------------------------------
  'profile.role.mom': 'Mom',
  'profile.role.dad': 'Dad',
  'profile.role.parent': 'Parent',
  'profile.role.label': 'I am a',
  'profile.role.hint': 'Shown on your public profile. You can leave this blank.',
  'profile.children': 'Children',
  'profile.editProfileAndChildren': 'Edit Profile & Children',
  'profile.notificationSettings': 'Notification settings',
  'profile.blockedMembers': 'Blocked members',
  'profile.terms': 'Terms of Service',
  'profile.privacy': 'Privacy Policy',
  'profile.signOut': 'Sign out',
  'profile.signOutConfirm': 'Sign out?',
  'profile.neighborhood': 'Neighborhood',
  'profile.occupation': 'Occupation',
  'profile.bio': 'About',
  'profile.memberSince': 'Member since {date}',
  /** "Mom of 2" — the noun is already localized before it reaches this. */
  'profile.roleOfCount': '{role} of {count}',
} as const;

export type TranslationKey = keyof typeof en;
export type Dictionary = Readonly<Partial<Record<TranslationKey, string>>>;
