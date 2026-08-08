import type { TranslationKey } from '@/i18n';

export interface ActivityCapacityInput {
  /** null means the host set no limit. */
  capacity: number | null;
  attendeeCount: number;
  /** Whether the viewer has already joined. */
  isAttending?: boolean;
  isHost?: boolean;
}

export interface CapacityPresentation {
  /** null when there is nothing honest to say — an activity with no configured
   *  capacity gets NO label rather than an invented one. */
  key: TranslationKey | null;
  /** Interpolation params for `key`, when it takes a count. */
  params?: { count: number };
  tone: 'neutral' | 'urgent' | 'full' | 'joined';
  /** Remaining places, clamped at zero. null when uncapped. */
  spotsLeft: number | null;
  isFull: boolean;
}

/** Fewer than this many places left reads as urgent rather than routine. */
export const LOW_CAPACITY_THRESHOLD = 3;

/** Turns raw capacity/attendance into the one thing worth saying.
 *
 *  Precedence is deliberate:
 *    1. "You're going"  — the viewer's own state is the most useful fact, and
 *       stays true even once the activity fills up behind them.
 *    2. "Hosting"       — a host is not an attendee and should not be told
 *       there are spots left in their own activity.
 *    3. "Full" / "N spots left" — only when a capacity is actually configured.
 *
 *  An activity with no capacity returns key: null. Inventing "unlimited spots"
 *  would be noise, and inventing a number would be a lie. */
export function activityCapacityPresentation(input: ActivityCapacityInput): CapacityPresentation {
  const attending = Math.max(0, input.attendeeCount);
  const hasCapacity = typeof input.capacity === 'number' && Number.isFinite(input.capacity) && input.capacity > 0;
  // Never negative, even if attendance somehow exceeds capacity (a race, or a
  // host lowering the limit after people joined).
  const spotsLeft = hasCapacity ? Math.max(0, (input.capacity as number) - attending) : null;
  const isFull = hasCapacity && spotsLeft === 0;

  if (input.isAttending) {
    return { key: 'activity.capacity.youreGoing', tone: 'joined', spotsLeft, isFull };
  }
  if (input.isHost) {
    return { key: 'activity.capacity.hosting', tone: 'joined', spotsLeft, isFull };
  }
  if (!hasCapacity) {
    return { key: null, tone: 'neutral', spotsLeft: null, isFull: false };
  }
  if (isFull) {
    return { key: 'activity.capacity.full', tone: 'full', spotsLeft: 0, isFull: true };
  }
  return {
    key: spotsLeft === 1 ? 'activity.capacity.oneSpotLeft' : 'activity.capacity.spotsLeft',
    params: { count: spotsLeft as number },
    tone: (spotsLeft as number) <= LOW_CAPACITY_THRESHOLD ? 'urgent' : 'neutral',
    spotsLeft,
    isFull: false,
  };
}
