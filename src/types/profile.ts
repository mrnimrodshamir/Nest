import type { ParentRole } from '@/utils/parentRole';

export interface NotificationPreferences {
  activity_changes: boolean;
  chat_messages: boolean;
  reminders: boolean;
  /** "What's on today" — the Daily Digest push. Opt-in only: a missing or
   *  false value must always be treated as off, never silently enabled. */
  daily_digest: boolean;
}

/** Own full profile — matches the private `profiles` table (own row only).
 *  Children live in their own table (see `Child`) — a parent can have any
 *  number of them, not just the one this shape used to hardcode. */
export interface Profile {
  id: string;
  displayName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  onboardingCompleted: boolean;
  notificationPreferences: NotificationPreferences;
  /** Self-selected only; null renders as the neutral "Parent". */
  parentRole: ParentRole;
  /** ISO date, optional and PRIVATE. Never published — other users see only
   *  the derived whole-year age via public_profiles.age_years. */
  birthdate: string | null;
  /** Caregiver-facing area label only. Exact coordinates are not profile data. */
  neighborhood: string | null;
  occupation: string | null;
  /** Optional public introduction, limited to 300 characters by every writer. */
  bio: string | null;
}

/** Minimal public surface for other users — matches the `public_profiles`
 *  view, which folds in each profile's *default* child for display. */
export interface PublicProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  childNames: string[];
  childAgesMonths: Array<number | null>;
  childCount: number;
  parentRole: ParentRole;
  ageYears: number | null;
  neighborhood: string | null;
  occupation: string | null;
  bio: string | null;
  verified: boolean;
  memberSince: string;
}
