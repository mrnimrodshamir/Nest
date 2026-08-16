import { dateLocaleTag, translate, type AppLocale } from '@/i18n/core';

export type ChatSystemEvent =
  | 'participant_joined'
  | 'participant_left'
  | 'activity_cancelled'
  | 'date_changed'
  | 'time_changed'
  | 'location_changed'
  | 'capacity_changed';

type Metadata = Readonly<Record<string, unknown>>;

/** Renders only NestUp-authored structured events. User messages never pass
 * through this function and are always displayed byte-for-byte as written. */
export function formatChatSystemMessage(metadata: Metadata | null, locale: AppLocale): string {
  const event = typeof metadata?.event === 'string' ? metadata.event as ChatSystemEvent : null;
  const name = typeof metadata?.actor_name === 'string' && metadata.actor_name.trim()
    ? metadata.actor_name.trim()
    : translate(locale, 'profile.memberFallback');

  switch (event) {
    case 'participant_joined': {
      const children = Array.isArray(metadata?.child_names)
        ? metadata.child_names.filter((value): value is string => typeof value === 'string' && Boolean(value.trim())).map((value) => value.trim())
        : [];
      if (children.length) {
        const childList = new Intl.ListFormat(dateLocaleTag(locale), { style: 'long', type: 'conjunction' }).format(children);
        return translate(locale, 'chat.system.participantJoinedWith', { name, children: childList });
      }
      return translate(locale, 'chat.system.participantJoined', { name });
    }
    case 'participant_left': return translate(locale, 'chat.system.participantLeft', { name });
    case 'activity_cancelled': return translate(locale, 'chat.system.activityCancelled');
    case 'date_changed': return translate(locale, 'chat.system.dateChanged');
    case 'time_changed': return translate(locale, 'chat.system.timeChanged');
    case 'location_changed': return translate(locale, 'chat.system.locationChanged');
    case 'capacity_changed': {
      const capacity = typeof metadata?.new_value === 'number' ? metadata.new_value : null;
      return capacity === null
        ? translate(locale, 'chat.system.activityUpdated')
        : translate(locale, 'chat.system.capacityChanged', { capacity });
    }
    default: return translate(locale, 'chat.system.activityUpdated');
  }
}
