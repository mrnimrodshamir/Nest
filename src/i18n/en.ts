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
  /** Spoken label — the visual badge is hidden from assistive tech, since a
   *  bare number read after a title means nothing. */
  'chats.unreadLabel': '{name}, {count} unread',
  'chats.activityChat': 'Activity chat',

  // --- Forums ------------------------------------------------------------
  'forum.communitySpace': 'Community',
  'forum.pinned': 'Pinned',
  'forum.allForums': 'All forums',
  'forum.searchPlaceholder': 'Search forums',
  'forum.searchLabel': 'Search forums by name or description',
  'forum.noSearchResults': 'No forums match that search.',
  'forum.noSearchResultsBody': 'Try a different word, or clear the search.',
  'forum.tel-aviv-moms.title': 'Tel Aviv Moms',
  'forum.tel-aviv-moms.description': 'Local questions, meetups and recommendations for moms in Tel Aviv.',
  'forum.tel-aviv-dads.title': 'Tel Aviv Dads',
  'forum.tel-aviv-dads.description': 'Local questions, meetups and recommendations for dads in Tel Aviv.',
  'forum.breastfeeding.title': 'Breastfeeding',
  'forum.breastfeeding.description': 'Feeding, pumping and breastfeeding support.',
  'forum.child-development.title': 'Child Development',
  'forum.child-development.description': 'Milestones, development and everyday questions.',
  'forum.parental-leave.title': 'Parents on Parental Leave',
  'forum.parental-leave.description': 'Meet other parents and share ideas during parental leave.',
  'forum.baby-sleep.title': 'Baby Sleep',
  'forum.baby-sleep.description': 'Sleep routines, naps and everyday sleep questions.',
  'forum.starting-solids.title': 'Starting Solids & Baby Nutrition',
  'forum.starting-solids.description': 'Starting solids, feeding and practical nutrition questions.',
  'forum.things-to-do-tel-aviv.title': 'Things to Do with Kids in Tel Aviv',
  'forum.things-to-do-tel-aviv.description': 'Places, events and local ideas for families.',
  'forum.local-recommendations.title': 'Local Recommendations',
  'forum.local-recommendations.description': 'Local services, places and parent-to-parent recommendations.',
  'forum.pregnancy-postpartum.title': 'Pregnancy & Postpartum',
  'forum.pregnancy-postpartum.description': 'Pregnancy, recovery and the transition into parenthood.',
  'forum.first-time-parents.title': 'First-Time Parents',
  'forum.first-time-parents.description': 'Support and questions for parents navigating their first child.',
  'forum.daycare-preschools.title': 'Daycare & Preschools',
  'forum.daycare-preschools.description': 'Local childcare, registration, daycare and preschool discussions.',

  // --- Place details -----------------------------------------------------
  'place.title': 'Place details',
  'place.loadError': "Couldn't load place",
  'place.loading': 'Loading place…',
  'place.openInAppleMaps': 'Open in Apple Maps',
  'place.whatsHere': "What's here",
  'place.cost': 'Cost',
  'place.openingHours': 'Opening hours',
  'place.todayHere': 'Today Here',
  'place.upcomingHere': 'Upcoming Here',
  'place.loadingEvents': 'Loading events here…',
  'place.visitWebsite': 'Visit website',
  'place.lastVerified': 'Last verified {date}',
  'place.createActivityHere': 'Create activity here',
  /** {name} is a venue name — never translated, only interpolated. */
  'place.shareLabel': 'Share {name}',
  'place.shareWhatsAppLabel': 'Share {name} on WhatsApp',

  // --- Event details -----------------------------------------------------
  'event.title': 'Event details',
  'event.loadError': "Couldn't load event",
  'event.loading': 'Loading event…',
  'event.registration': 'Registration',
  'event.viewSource': 'View official source',
  'event.addToCalendarLabel': 'Add {name} to calendar',
  'event.location': 'Location',
  'event.cancelled': 'Cancelled',
  'event.postponed': 'Postponed',

  // Event lifecycle badges.
  'event.lifecycle.live': 'LIVE NOW',
  'event.lifecycle.startingSoon': 'STARTING SOON',
  'event.lifecycle.today': 'TODAY',
  'event.lifecycle.upcoming': 'Upcoming',
  'event.lifecycle.finished': 'Finished',
  'event.lifecycle.cancelled': 'Cancelled',
  'event.lifecycle.postponed': 'Postponed',

  // NestUp RSVP. Never implies external registration.
  'event.rsvp.join': "I'm going",
  'event.rsvp.going': "You're going",
  'event.rsvp.unavailable': 'This event is not open',
  'event.rsvp.disclaimer': 'This tells other NestUp parents. It does not register you with the organizer.',
  'event.registerExternally': 'Register with organizer',
  'event.attendance.going': '{count} NestUp parents going',
  'event.attendance.oneGoing': '1 NestUp parent going',
  'event.attendance.cardGoing': '{count} going',
  'event.attendance.overflow': '+{count}',
  'event.attendance.title': "Who's going",
  'event.recurring': 'Recurring',

  // Activity capacity.
  'activity.capacity.spotsLeft': '{count} spots left',
  'activity.capacity.oneSpotLeft': '1 spot left',
  'activity.capacity.full': 'Full',
  'activity.capacity.youreGoing': "You're going",
  'activity.capacity.hosting': "You're hosting",

  // --- Activity Details --------------------------------------------------
  'activity.details': 'Details',
  'activity.host': 'Host',
  'activity.location': 'Location',
  'activity.directions': 'Directions',
  'activity.message': 'Message',
  'activity.openGroupChat': 'Open group chat',
  'activity.shareActivity': 'Share activity',
  'activity.moreOptions': 'More options',
  'activity.joining': 'Joining',
  'activity.noOneJoined': 'No one else has joined yet.',
  'activity.loadingParticipants': 'Loading participants…',
  'activity.tapParticipant': 'Tap a participant to see their profile',
  'activity.createAgain': 'Create again',

  // --- Activity create / edit --------------------------------------------
  'activity.hostActivityTitle': 'Host an activity',
  'activity.editActivity': 'Edit activity',
  'activity.cancelActivity': 'Cancel this activity',
  'activity.cancelConfirmTitle': 'Cancel this activity?',
  'activity.cancelConfirmBody': "Everyone who joined will be notified. This can't be undone.",
  'activity.keepActivity': 'Keep activity',
  'activity.confirmCancel': 'Cancel activity',
  'activity.retryJoining': 'Retry joining your activity',
  'common.saveChanges': 'Save changes',

  // --- Edit Profile ------------------------------------------------------
  'profile.editTitle': 'Profile & children',
  'profile.yourName': 'Your name',
  'profile.childName': "Child's name",
  'profile.enterChildName': "Enter the child's name",
  'profile.gender': 'Gender',
  'profile.girl': 'Girl',
  'profile.boy': 'Boy',
  'profile.addAnotherChild': 'Add another child',
  'profile.defaultForMatching': 'Default for matching',
  'profile.useAsDefault': 'Use as default child for activity matching',

  // --- Chat --------------------------------------------------------------
  'chat.messagePlaceholder': 'Message',
  'chat.send': 'Send',
  'chat.notSent': 'Not sent — tap to retry',
  'chat.conversationStart': 'This is the start of your conversation.',

  // --- Share Activity ----------------------------------------------------
  'share.live': 'Your activity is live.',
  'share.meetingAt': 'Meeting at',
  'share.chosenPoint': 'Your chosen meeting point',
  'share.invite': 'Invite nearby parents and caregivers.',
  'share.onWhatsApp': 'Share on WhatsApp',
  'share.moreOptions': 'More sharing options',
  'share.viewActivity': 'View activity',

  // --- My Activities -----------------------------------------------------
  'myActivities.upcoming': 'Upcoming',
  'myActivities.past': 'Past',

  // --- Profile / members -------------------------------------------------
  'profile.unblock': 'Unblock',
  'profile.notFound': 'This member could not be found',
  'profile.deletedAccount': 'They may have deleted their account.',

  'common.whatsapp': 'WhatsApp',

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
