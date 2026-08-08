import type { TranslationKey } from '@/i18n';
import type { EventLifecycleStatus } from '@/types/event';

/** An event counts as STARTING SOON within this window before its start.
 *
 *  90 minutes is chosen to be actionable rather than merely imminent: it is
 *  roughly enough time to decide, get a child ready and travel across Tel
 *  Aviv. A shorter window (15–30 min) would only ever fire for people already
 *  on their way, which is not a useful nudge. */
export const STARTING_SOON_MINUTES = 90;

export type EventBadgeTone = 'live' | 'soon' | 'today' | 'neutral' | 'muted' | 'warning';

export interface EventBadge {
  key: TranslationKey;
  tone: EventBadgeTone;
  /** False for states that are over or called off, so callers can render them
   *  quietly instead of as exciting active content. */
  isActive: boolean;
}

const BADGES: Record<EventLifecycleStatus, EventBadge> = {
  live: { key: 'event.lifecycle.live', tone: 'live', isActive: true },
  today: { key: 'event.lifecycle.today', tone: 'today', isActive: true },
  upcoming: { key: 'event.lifecycle.upcoming', tone: 'neutral', isActive: true },
  // Deliberately muted/warning and NOT active: a cancelled or finished event
  // must never read like something to go to.
  finished: { key: 'event.lifecycle.finished', tone: 'muted', isActive: false },
  cancelled: { key: 'event.lifecycle.cancelled', tone: 'warning', isActive: false },
  postponed: { key: 'event.lifecycle.postponed', tone: 'warning', isActive: false },
};

/** Presentation for an already-resolved lifecycle status.
 *
 *  This layer NEVER re-derives lifecycle — `resolveEventLifecycle` remains the
 *  single source of truth for whether an event is live, finished or called
 *  off. All this adds is the STARTING SOON refinement, which only ever
 *  narrows the existing `today` state and can therefore never contradict it. */
export function eventLifecycleBadge(
  lifecycle: EventLifecycleStatus,
  startsAt: string,
  now: Date = new Date(),
): EventBadge {
  if (lifecycle !== 'today') return BADGES[lifecycle];

  const start = Date.parse(startsAt);
  // An unparseable start time falls back to the plain Today badge rather than
  // guessing — the lifecycle resolver already validated the real data.
  if (!Number.isFinite(start)) return BADGES.today;

  const minutesAway = (start - now.getTime()) / 60000;
  // Strictly in the future: once the start time passes, the resolver owns the
  // state (live or finished) and this branch must not claim "starting soon".
  if (minutesAway > 0 && minutesAway <= STARTING_SOON_MINUTES) {
    return { key: 'event.lifecycle.startingSoon', tone: 'soon', isActive: true };
  }
  return BADGES.today;
}

/** True when the event should be presented as something a parent can still
 *  act on. Cancelled, postponed and finished events are excluded. */
export function isActionableEvent(lifecycle: EventLifecycleStatus): boolean {
  return BADGES[lifecycle].isActive;
}
