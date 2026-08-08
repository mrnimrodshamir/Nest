import type { TranslationKey } from '@/i18n';
import type { EventLifecycleStatus } from '@/types/event';
import { isActionableEvent } from '@/utils/eventLifecyclePresentation';

export interface EventRsvpState {
  isGoing: boolean;
  attendeeCount: number;
  lifecycle: EventLifecycleStatus;
}

export interface RsvpPresentation {
  /** Label for the RSVP control. */
  key: TranslationKey;
  /** False for cancelled/postponed/finished events — you cannot say you are
   *  going to something that is over or called off. */
  enabled: boolean;
  /** Whether the control reads as an active, already-chosen state. */
  selected: boolean;
}

/** The NestUp RSVP control.
 *
 *  CRITICAL PRODUCT RULE: this is NestUp attendance ONLY. It never registers
 *  anyone with the municipality, DigiTel, the venue, the organiser or a ticket
 *  provider. External registration is a separate action with its own label,
 *  and the two must never be merged — a parent who taps "I'm going" and
 *  believes they hold a ticket is a real harm, not a cosmetic one. */
export function rsvpPresentation(state: EventRsvpState): RsvpPresentation {
  const enabled = isActionableEvent(state.lifecycle);
  if (!enabled) {
    return { key: 'event.rsvp.unavailable', enabled: false, selected: false };
  }
  return state.isGoing
    ? { key: 'event.rsvp.going', enabled: true, selected: true }
    : { key: 'event.rsvp.join', enabled: true, selected: false };
}

/** Count line for Event Details.
 *
 *  Always says NestUp explicitly. The number is how many NestUp parents said
 *  they are going — NOT the event's real attendance, which we have no way of
 *  knowing for a municipal event. Returns null at zero so an empty event shows
 *  nothing rather than a discouraging "0 going". */
export function attendanceSummaryKey(count: number): { key: TranslationKey; params: { count: number } } | null {
  if (count <= 0) return null;
  return {
    key: count === 1 ? 'event.attendance.oneGoing' : 'event.attendance.going',
    params: { count },
  };
}

/** Compact signal for an Event CARD. Secondary by design, and absent at zero
 *  so cards are not cluttered with noise. */
export function attendanceCardKey(count: number): { key: TranslationKey; params: { count: number } } | null {
  if (count <= 0) return null;
  return { key: 'event.attendance.cardGoing', params: { count } };
}

/** How many avatars to preview before collapsing into "+N". */
export const AVATAR_PREVIEW_LIMIT = 5;

export interface AttendeePreview<T> {
  shown: T[];
  overflow: number;
}

/** Splits attendees into a small preview plus an overflow count. */
export function attendeePreview<T>(attendees: readonly T[], limit = AVATAR_PREVIEW_LIMIT): AttendeePreview<T> {
  return {
    shown: attendees.slice(0, limit),
    overflow: Math.max(0, attendees.length - limit),
  };
}
