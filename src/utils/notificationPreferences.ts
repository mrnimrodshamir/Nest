import type { NotificationPreferences } from '@/types/profile';

/** Missing preference keys always fail closed. Daily and Weekly are mapped
 * independently so reading or saving one can never silently enable the other. */
export function mapNotificationPreferences(
  row: Partial<NotificationPreferences> | null | undefined,
): NotificationPreferences {
  return {
    activity_changes: row?.activity_changes === true,
    chat_messages: row?.chat_messages === true,
    reminders: row?.reminders === true,
    daily_digest: row?.daily_digest === true,
    weekly_digest: row?.weekly_digest === true,
    weekend_digest: row?.weekend_digest === true,
  };
}
