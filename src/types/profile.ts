export interface NotificationPreferences {
  activity_changes: boolean;
  chat_messages: boolean;
  reminders: boolean;
}

/** Own full profile — matches the private `profiles` table (own row only). */
export interface Profile {
  id: string;
  displayName: string;
  email: string;
  phone: string | null;
  avatarUrl: string | null;
  babyName: string | null;
  babyBirthdate: string | null; // ISO date (yyyy-mm-dd)
  onboardingCompleted: boolean;
  notificationPreferences: NotificationPreferences;
}

/** Minimal public surface for other users — matches the `public_profiles` view. */
export interface PublicProfile {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  babyName: string | null;
  babyAgeMonths: number | null;
  verified: boolean;
}
