import type { ParentRole } from '@/utils/parentRole';

export interface NotificationPreferences {
  activity_changes: boolean;
  chat_messages: boolean;
  reminders: boolean;
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
}

/** Minimal public surface for other users — matches the `public_profiles`
 *  view, which folds in each profile's *default* child for display. */
export interface PublicProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  babyName: string | null;
  babyAgeMonths: number | null;
  verified: boolean;
  memberSince: string;
}
