import type { TranslationKey } from '@/i18n';

/** The fixed, curated forum set for this release.
 *
 *  These keys are a CONTRACT: they match `forums.key` in the database, drive
 *  the `nestup://forum/<key>` deep links, and index the translation
 *  dictionaries. Changing one breaks existing links and orphans a forum's
 *  message history, so they must never be edited once shipped.
 *
 *  Users cannot create forums in this version — there is no client path to
 *  insert one, and the database has no INSERT policy on `forums` or `chats`. */
export const FORUM_KEYS = [
  'tel-aviv-moms',
  'tel-aviv-dads',
  'breastfeeding',
  'child-development',
  'parental-leave',
  'baby-sleep',
  'starting-solids',
  'things-to-do-tel-aviv',
  'local-recommendations',
  'pregnancy-postpartum',
  'first-time-parents',
  'daycare-preschools',
] as const;

export type ForumKey = (typeof FORUM_KEYS)[number];

export interface ForumDefinition {
  key: ForumKey;
  titleKey: TranslationKey;
  descriptionKey: TranslationKey;
  /** Phosphor icon name, mirrored by `forums.icon` in the seed migration. */
  icon: string;
  /** Presentation order. The server orders identically; the client re-sorts
   *  so the list is stable even if a row arrives without metadata. */
  sortOrder: number;
  /** Curated by NestUp, never by the user. Pinned forums render in a small
   *  section above the rest so the highest-traffic spaces stay reachable
   *  without scrolling. */
  pinned?: boolean;
}

export const FORUMS: readonly ForumDefinition[] = Object.freeze([
  { key: 'tel-aviv-moms', titleKey: 'forum.tel-aviv-moms.title', descriptionKey: 'forum.tel-aviv-moms.description', icon: 'users-three', sortOrder: 10 },
  { key: 'tel-aviv-dads', titleKey: 'forum.tel-aviv-dads.title', descriptionKey: 'forum.tel-aviv-dads.description', icon: 'users-three', sortOrder: 20 },
  { key: 'breastfeeding', titleKey: 'forum.breastfeeding.title', descriptionKey: 'forum.breastfeeding.description', icon: 'heart', sortOrder: 30 },
  { key: 'child-development', titleKey: 'forum.child-development.title', descriptionKey: 'forum.child-development.description', icon: 'plant', sortOrder: 40 },
  { key: 'parental-leave', titleKey: 'forum.parental-leave.title', descriptionKey: 'forum.parental-leave.description', icon: 'house', sortOrder: 50, pinned: true },
  { key: 'baby-sleep', titleKey: 'forum.baby-sleep.title', descriptionKey: 'forum.baby-sleep.description', icon: 'moon', sortOrder: 60 },
  { key: 'starting-solids', titleKey: 'forum.starting-solids.title', descriptionKey: 'forum.starting-solids.description', icon: 'bowl-food', sortOrder: 70 },
  { key: 'things-to-do-tel-aviv', titleKey: 'forum.things-to-do-tel-aviv.title', descriptionKey: 'forum.things-to-do-tel-aviv.description', icon: 'map-trifold', sortOrder: 80, pinned: true },
  { key: 'local-recommendations', titleKey: 'forum.local-recommendations.title', descriptionKey: 'forum.local-recommendations.description', icon: 'star', sortOrder: 90, pinned: true },
  { key: 'pregnancy-postpartum', titleKey: 'forum.pregnancy-postpartum.title', descriptionKey: 'forum.pregnancy-postpartum.description', icon: 'baby', sortOrder: 100 },
  { key: 'first-time-parents', titleKey: 'forum.first-time-parents.title', descriptionKey: 'forum.first-time-parents.description', icon: 'hand-heart', sortOrder: 110 },
  { key: 'daycare-preschools', titleKey: 'forum.daycare-preschools.title', descriptionKey: 'forum.daycare-preschools.description', icon: 'backpack', sortOrder: 120 },
]);

const FORUM_BY_KEY = new Map<string, ForumDefinition>(FORUMS.map((forum) => [forum.key, forum]));

/** Guards a value arriving from the database or a deep link. An unrecognised
 *  key means a forum the client does not know about — it is skipped rather
 *  than rendered with a raw key as its title. */
export function isForumKey(value: unknown): value is ForumKey {
  return typeof value === 'string' && FORUM_BY_KEY.has(value);
}

export function forumDefinition(key: string): ForumDefinition | null {
  return FORUM_BY_KEY.get(key) ?? null;
}

/** `nestup://forum/breastfeeding`. Keys are already URL-safe, but they are
 *  encoded anyway so a future key containing a reserved character cannot
 *  produce a malformed link. */
export function forumDeepLink(key: ForumKey): string {
  return `nestup://forum/${encodeURIComponent(key)}`;
}
