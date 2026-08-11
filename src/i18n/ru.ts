import type { Dictionary } from './en';

/** Russian. Every key in `en` has an entry here — a gap would fall back to
 *  English mid-screen, which reads worse than a slightly awkward translation.
 *
 *  Register: вы-form throughout, matching the French dictionary's choice.
 *
 *  A note on plurals. Russian has three plural forms (1 / 2-4 / 5+), and this
 *  dictionary only has the app's one/other key pairs to work with. Rather than
 *  render "{count} активности" and be wrong two thirds of the time, the
 *  "other" strings are phrased so the noun does not have to agree with the
 *  number — "Активности поблизости: {count}". That is idiomatic Russian, it is
 *  how counts are commonly presented in UI, and it is correct for every value
 *  of {count}. Adding true plural categories would mean changing the shared key
 *  scheme, which is out of scope here.
 *
 *  RUSSIAN IS LTR. It uses Cyrillic, not an RTL script — see core.RTL_LOCALES,
 *  which lists Hebrew alone. */
export const ru: Dictionary = {
  // --- Language selector -------------------------------------------------
  'language.title': 'Язык',
  'language.english': 'English',
  'language.hebrew': 'עברית',
  'language.french': 'Français',
  'language.russian': 'Русский',
  'language.system': 'Как на устройстве',
  'language.systemHint': 'Использовать язык устройства',
  'language.restartHint': 'Перезапустите NestUp, чтобы завершить смену направления текста.',

  // --- Navigation --------------------------------------------------------
  'nav.discovery': 'Обзор',
  'nav.chats': 'Чаты',
  'nav.myActivities': 'Мои встречи',
  'nav.profile': 'Профиль',

  // --- Discovery ---------------------------------------------------------
  'discovery.search': 'Поиск',
  'discovery.searchPlaceholder': 'Поиск встреч, мест и событий',
  'discovery.closeSearch': 'Закрыть поиск',
  'discovery.filters': 'Фильтры',
  'discovery.sort': 'Сортировка',
  'discovery.activities': 'Встречи',
  'discovery.places': 'Места',
  'discovery.events': 'События',
  'discovery.loading': 'Загрузка…',
  'discovery.retry': 'Повторить',
  'discovery.clearFilters': 'Сбросить фильтры',
  'discovery.expandArea': 'Расширить область поиска',
  'discovery.hostActivity': 'Организовать встречу',
  'discovery.map': 'Карта',
  'discovery.list': 'Список',

  'discovery.contentTypes': 'Типы содержимого',
  'discovery.selectAll': 'Выбрать все',
  'discovery.sortListTitle': 'Сортировать список',
  'discovery.sortHint': 'Сортировка меняет только список. Метки на карте остаются на местах.',
  'discovery.swipeUp': 'Проведите вверх, чтобы посмотреть',
  'discovery.finding': 'Ищем варианты поблизости…',
  'discovery.searchThisArea': 'Искать в этой области',

  // Phrased so the noun never has to agree with {count} — see the note above.
  'discovery.count.activities.one': '1 встреча поблизости',
  'discovery.count.activities.other': 'Встречи поблизости: {count}',
  'discovery.count.places.one': '1 место в этой области',
  'discovery.count.places.other': 'Места в этой области: {count}',
  'discovery.count.events.one': '1 событие в этой области',
  'discovery.count.events.other': 'События в этой области: {count}',
  'discovery.count.mixed': 'Поблизости: {count}',

  'discovery.empty.all': 'Пока рядом нет ничего, что подходит под ваши фильтры.',
  'discovery.empty.activities': 'Нет встреч, подходящих под ваши фильтры.',
  'discovery.empty.places': 'Нет мест, подходящих под ваши фильтры.',
  'discovery.empty.events': 'Нет событий, подходящих под ваши фильтры.',
  'discovery.empty.activitiesPlaces': 'Нет встреч или мест, подходящих под ваши фильтры.',
  'discovery.empty.activitiesEvents': 'Нет встреч или событий, подходящих под ваши фильтры.',
  'discovery.empty.placesEvents': 'Нет мест или событий, подходящих под ваши фильтры.',
  'discovery.empty.body': 'Подвиньте карту, измените фильтр или поищите поблизости.',
  'discovery.empty.bodyLocationOff': 'Доступ к геолокации выключен, поэтому эта область может быть далеко от вас.',

  'discovery.error.activities': 'Не удалось обновить встречи',
  'discovery.error.places': 'Не удалось обновить места',
  'discovery.error.events': 'Не удалось обновить события',

  // --- Filters -----------------------------------------------------------
  'filters.title': 'Фильтры',
  'filters.content': 'Содержимое',
  'filters.reset': 'Сбросить',
  'filters.resetAll': 'Сбросить все',
  'filters.apply': 'Применить',
  'filters.activeCount': 'Активных: {count}',
  'filters.keepOneType': 'Оставьте выбранным хотя бы один тип содержимого.',
  'filters.showType': 'Показать {type}',
  'filters.withCount': 'Фильтры · {count}',

  // --- Sort --------------------------------------------------------------
  'sort.title': 'Сортировка',
  'sort.default': 'Рекомендуемые',
  'sort.distance': 'По расстоянию',
  'sort.soonest': 'По времени',
  'sort.alphabetical': 'По алфавиту',

  // --- Common actions ----------------------------------------------------
  'common.share': 'Поделиться',
  'common.addToCalendar': 'Добавить в календарь',
  'common.openMaps': 'Открыть в Картах',
  'common.createActivity': 'Создать встречу',
  'common.viewActivity': 'Открыть встречу',
  'common.viewPlace': 'Открыть место',
  'common.viewEvent': 'Открыть событие',
  'common.editProfile': 'Редактировать профиль',
  'common.back': 'Назад',
  'common.cancel': 'Отмена',
  'common.save': 'Сохранить',
  'common.done': 'Готово',
  'common.close': 'Закрыть {what}',
  'common.retry': 'Повторить',
  'common.retryLabel': '{label}. Повторить',

  // --- Chats sections ----------------------------------------------------
  'chats.section.active': 'Чаты',
  'chats.section.past': 'Прошедшие чаты',
  'chats.section.forums': 'Форумы',
  'chats.empty.active': 'Активных чатов пока нет.',
  'chats.empty.past': 'Здесь появятся чаты прошедших встреч.',
  'chats.empty.activeBody': 'Присоединитесь к встрече или организуйте свою, чтобы начать общение.',
  'chats.empty.pastBody': 'Когда встреча закончится, её чат переедет сюда.',
  'chats.error.forums': 'Не удалось загрузить форумы.',
  'chats.error.load': 'Не удалось загрузить сообщения.',
  'chats.noMessagesYet': 'Поздоровайтесь 👋',
  'chats.you': 'Вы',
  'chats.happenedOn': '{date} · {time}',
  'chats.directChat': 'Личный чат',
  'chats.unreadLabel': '{name}, непрочитанных: {count}',
  'chats.activityChat': 'Чат встречи',

  // --- Forums ------------------------------------------------------------
  'forum.communitySpace': 'Сообщество',
  'forum.pinned': 'Закреплённые',
  'forum.allForums': 'Все форумы',
  'forum.searchPlaceholder': 'Поиск форумов',
  'forum.searchLabel': 'Искать форум по названию или описанию',
  'forum.noSearchResults': 'Нет форумов, подходящих под этот запрос.',
  'forum.noSearchResultsBody': 'Попробуйте другое слово или очистите поиск.',
  'forum.tel-aviv-moms.title': 'Мамы Тель-Авива',
  'forum.tel-aviv-moms.description': 'Местные вопросы, встречи и рекомендации для мам в Тель-Авиве.',
  'forum.tel-aviv-dads.title': 'Папы Тель-Авива',
  'forum.tel-aviv-dads.description': 'Местные вопросы, встречи и рекомендации для пап в Тель-Авиве.',
  'forum.breastfeeding.title': 'Грудное вскармливание',
  'forum.breastfeeding.description': 'Кормление, сцеживание и поддержка грудного вскармливания.',
  'forum.child-development.title': 'Развитие ребёнка',
  'forum.child-development.description': 'Этапы развития и повседневные вопросы.',
  'forum.parental-leave.title': 'Родители в декрете',
  'forum.parental-leave.description': 'Знакомьтесь с другими родителями и делитесь идеями во время отпуска по уходу.',
  'forum.baby-sleep.title': 'Детский сон',
  'forum.baby-sleep.description': 'Режим сна, дневной сон и повседневные вопросы.',
  'forum.starting-solids.title': 'Прикорм и питание',
  'forum.starting-solids.description': 'Введение прикорма, кормление и практические вопросы питания.',
  'forum.things-to-do-tel-aviv.title': 'Чем заняться с детьми в Тель-Авиве',
  'forum.things-to-do-tel-aviv.description': 'Места, события и местные идеи для семей.',
  'forum.local-recommendations.title': 'Местные рекомендации',
  'forum.local-recommendations.description': 'Местные услуги, места и рекомендации от родителей родителям.',
  'forum.pregnancy-postpartum.title': 'Беременность и после родов',
  'forum.pregnancy-postpartum.description': 'Беременность, восстановление и переход к родительству.',
  'forum.first-time-parents.title': 'Родители впервые',
  'forum.first-time-parents.description': 'Поддержка и вопросы для родителей первого ребёнка.',
  'forum.daycare-preschools.title': 'Ясли и детские сады',
  'forum.daycare-preschools.description': 'Уход за детьми, запись, ясли и детские сады.',

  // --- Place details -----------------------------------------------------
  'place.title': 'О месте',
  'place.loadError': 'Не удалось загрузить место',
  'place.loading': 'Загрузка места…',
  'place.openInAppleMaps': 'Открыть в Apple Maps',
  'place.whatsHere': 'Что здесь есть',
  'place.cost': 'Стоимость',
  'place.openingHours': 'Часы работы',
  'place.todayHere': 'Сегодня здесь',
  'place.upcomingHere': 'Скоро здесь',
  'place.loadingEvents': 'Загрузка событий здесь…',
  'place.visitWebsite': 'Перейти на сайт',
  'place.lastVerified': 'Проверено {date}',
  'place.createActivityHere': 'Создать встречу здесь',
  'place.shareLabel': 'Поделиться: {name}',
  'place.shareWhatsAppLabel': 'Поделиться {name} в WhatsApp',

  // --- Event details -----------------------------------------------------
  'event.title': 'О событии',
  'event.loadError': 'Не удалось загрузить событие',
  'event.loading': 'Загрузка события…',
  'event.registration': 'Регистрация',
  'event.viewSource': 'Открыть официальный источник',
  'event.addToCalendarLabel': 'Добавить {name} в календарь',
  'event.location': 'Место',
  'event.cancelled': 'Отменено',
  'event.postponed': 'Перенесено',

  'event.lifecycle.live': 'ИДЁТ СЕЙЧАС',
  'event.lifecycle.startingSoon': 'СКОРО НАЧНЁТСЯ',
  'event.lifecycle.today': 'СЕГОДНЯ',
  'event.lifecycle.upcoming': 'Предстоит',
  'event.lifecycle.finished': 'Завершено',
  'event.lifecycle.cancelled': 'Отменено',
  'event.lifecycle.postponed': 'Перенесено',

  // NestUp RSVP — must never imply registration with the organizer.
  'event.rsvp.join': 'Я иду',
  'event.rsvp.going': 'Вы идёте',
  'event.rsvp.unavailable': 'Это событие закрыто',
  'event.rsvp.disclaimer': 'Это увидят другие родители в NestUp. Регистрация у организатора при этом не происходит.',
  'event.registerExternally': 'Зарегистрироваться у организатора',
  'event.attendance.going': 'Идут родителей из NestUp: {count}',
  'event.attendance.oneGoing': 'Идёт 1 родитель из NestUp',
  'event.attendance.cardGoing': 'Идут: {count}',
  'event.attendance.overflow': '+{count}',
  'event.attendance.title': 'Кто идёт',
  'event.recurring': 'Регулярное',

  'activity.capacity.spotsLeft': 'Свободных мест: {count}',
  'activity.capacity.oneSpotLeft': 'Осталось 1 место',
  'activity.capacity.full': 'Мест нет',
  'activity.capacity.youreGoing': 'Вы идёте',
  'activity.capacity.hosting': 'Вы организуете',

  // --- Activity Details --------------------------------------------------
  'activity.details': 'Подробности',
  'activity.host': 'Организатор',
  'activity.location': 'Место',
  'activity.directions': 'Маршрут',
  'activity.message': 'Сообщение',
  'activity.openGroupChat': 'Открыть групповой чат',
  'activity.shareActivity': 'Поделиться встречей',
  'activity.moreOptions': 'Ещё',
  'activity.joining': 'Участие',
  'activity.noOneJoined': 'Пока никто больше не присоединился.',
  'activity.loadingParticipants': 'Загрузка участников…',
  'activity.tapParticipant': 'Нажмите на участника, чтобы открыть профиль',
  'activity.createAgain': 'Создать снова',

  // --- Activity create / edit --------------------------------------------
  'activity.hostActivityTitle': 'Организовать встречу',
  'activity.editActivity': 'Редактировать встречу',
  'activity.cancelActivity': 'Отменить эту встречу',
  'activity.cancelConfirmTitle': 'Отменить эту встречу?',
  'activity.cancelConfirmBody': 'Все участники получат уведомление. Отменить это действие нельзя.',
  'activity.keepActivity': 'Оставить встречу',
  'activity.confirmCancel': 'Отменить встречу',
  'activity.retryJoining': 'Повторить создание встречи',
  'common.saveChanges': 'Сохранить изменения',

  // --- Edit Profile ------------------------------------------------------
  'profile.editTitle': 'Профиль и дети',
  'profile.yourName': 'Ваше имя',
  'profile.childName': 'Имя ребёнка',
  'profile.enterChildName': 'Введите имя ребёнка',
  'profile.gender': 'Пол',
  'profile.girl': 'Девочка',
  'profile.boy': 'Мальчик',
  'profile.addAnotherChild': 'Добавить ещё ребёнка',
  'profile.defaultForMatching': 'По умолчанию для подбора',
  'profile.useAsDefault': 'Использовать как ребёнка по умолчанию при подборе встреч',

  // --- Chat --------------------------------------------------------------
  'chat.messagePlaceholder': 'Сообщение',
  'chat.send': 'Отправить',
  'chat.notSent': 'Не отправлено — нажмите, чтобы повторить',
  'chat.conversationStart': 'Это начало вашей переписки.',

  // --- Share Activity ----------------------------------------------------
  'share.live': 'Ваша встреча опубликована.',
  'share.meetingAt': 'Встречаемся в',
  'share.chosenPoint': 'Выбранное вами место встречи',
  'share.invite': 'Пригласите родителей поблизости.',
  'share.onWhatsApp': 'Поделиться в WhatsApp',
  'share.moreOptions': 'Другие способы поделиться',
  'share.viewActivity': 'Открыть встречу',

  // --- My Activities -----------------------------------------------------
  'myActivities.upcoming': 'Предстоящие',
  'myActivities.past': 'Прошедшие',

  // --- Profile / members -------------------------------------------------
  'profile.unblock': 'Разблокировать',
  'profile.notFound': 'Этот участник не найден',
  'profile.deletedAccount': 'Возможно, аккаунт был удалён.',

  'common.whatsapp': 'WhatsApp',

  // --- Profile -----------------------------------------------------------
  'profile.role.mom': 'Мама',
  'profile.role.dad': 'Папа',
  'profile.role.parent': 'Родитель',
  'profile.role.label': 'Я',
  'profile.role.hint': 'Отображается в вашем публичном профиле. Можно не заполнять.',
  'profile.birthdate.label': 'Дата рождения',
  'profile.birthdate.placeholder': 'Не указана',
  'profile.birthdate.hint': 'Приватно. Другие родители видят только возраст, но никогда — дату.',
  'profile.birthdate.shows': 'В публичном профиле будет показано: {age}. Сама дата останется приватной.',
  'common.optional': 'Необязательно',
  'common.clear': 'Очистить',
  'profile.children': 'Дети',
  'profile.editProfileAndChildren': 'Редактировать профиль и детей',
  'profile.notificationSettings': 'Уведомления',
  'profile.blockedMembers': 'Заблокированные участники',
  'profile.terms': 'Условия использования',
  'profile.privacy': 'Политика конфиденциальности',
  'profile.signOut': 'Выйти',
  'profile.signOutConfirm': 'Выйти?',
  'profile.neighborhood': 'Район',
  'profile.occupation': 'Профессия',
  'profile.bio': 'О себе',
  'profile.memberSince': 'В NestUp с {date}',
  'profile.roleOfCount': '{role}, детей: {count}',
};
