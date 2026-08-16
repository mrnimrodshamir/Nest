import type { ActivityStatus } from '@/types/activity';
import { currentAppLocale, translate } from '@/i18n/core';

/** The single lifecycle state an activity is in RIGHT NOW, derived from
 *  server data plus the current clock. Never stored — a persisted display
 *  string goes stale the moment the clock moves past a boundary.
 *
 *  Ordering here IS the priority order; `resolveLifecycle` returns the
 *  first match. Cancelled outranks everything because a cancelled activity
 *  that is also full must never read as "Full". */
export type ActivityLifecycle =
  | 'cancelled'
  | 'completed'
  | 'in_progress'
  | 'starting_soon'
  | 'full'
  | 'spots_left'
  | 'upcoming';

/** Relationship to the viewer. Deliberately NOT part of the lifecycle
 *  union — an activity is simultaneously (say) "Starting soon" and
 *  "Hosting", and collapsing them into one badge loses information. */
export type ActivityRelationship = 'hosting' | 'joined' | 'none';

/** "Starting soon" opens exactly 60 minutes before start and closes at the
 *  instant of start, where "in progress" takes over. */
export const STARTING_SOON_WINDOW_MINUTES = 60;

/** At or below this many free places we surface the exact count ("2 spots
 *  left") rather than a generic "Upcoming" — scarcity is the useful signal. */
export const SPOTS_LEFT_THRESHOLD = 3;

const MINUTE_MS = 60_000;

export interface LifecycleInput {
  status: ActivityStatus;
  startTime: string;
  /** Explicit end time when the host set one. */
  endTime?: string | null;
  durationMinutes: number;
  capacity: number | null;
  /** ACTIVE attendees only — cancelled/removed records must be excluded by
   *  the caller, or capacity maths silently over-counts. */
  attendeeCount: number;
}

/** End of the activity: the explicit end time when present, otherwise
 *  start + duration. Exported because Completed/In-progress both hinge on
 *  it and it is worth asserting directly. */
export function resolveEndTime(input: LifecycleInput): number {
  if (input.endTime) return new Date(input.endTime).getTime();
  return new Date(input.startTime).getTime() + input.durationMinutes * MINUTE_MS;
}

/** Free places remaining. `null` capacity means uncapped, so never scarce. */
export function resolveSpotsLeft(input: LifecycleInput): number | null {
  if (input.capacity === null) return null;
  return Math.max(0, input.capacity - input.attendeeCount);
}

export function resolveLifecycle(input: LifecycleInput, now: Date = new Date()): ActivityLifecycle {
  const nowMs = now.getTime();
  const startMs = new Date(input.startTime).getTime();
  const endMs = resolveEndTime(input);

  // 1. Cancelled overrides every other consideration, including time.
  if (input.status === 'cancelled') return 'cancelled';

  // 2. Completed — either the server marked it, or the end time has passed.
  //    Checking both means a late `mark_completed_activities` run never
  //    leaves a finished activity showing as "In progress".
  if (input.status === 'completed' || nowMs >= endMs) return 'completed';

  // 3. Running right now: start <= now < end.
  if (nowMs >= startMs) return 'in_progress';

  // 4. Within the hour before start (start itself is handled above).
  if (startMs - nowMs <= STARTING_SOON_WINDOW_MINUTES * MINUTE_MS) return 'starting_soon';

  // 5/6. Capacity pressure, only for capped activities.
  const spotsLeft = resolveSpotsLeft(input);
  if (spotsLeft !== null) {
    if (spotsLeft === 0) return 'full';
    if (spotsLeft <= SPOTS_LEFT_THRESHOLD) return 'spots_left';
  }

  return 'upcoming';
}

/** User-facing label. `spots_left` needs the count, so it is passed rather
 *  than baked into the union. */
export function lifecycleLabel(lifecycle: ActivityLifecycle, spotsLeft: number | null): string {
  const locale = currentAppLocale();
  switch (lifecycle) {
    case 'cancelled':
      return translate(locale, 'activity.lifecycle.cancelled');
    case 'completed':
      return translate(locale, 'activity.lifecycle.completed');
    case 'in_progress':
      return translate(locale, 'activity.lifecycle.inProgress');
    case 'starting_soon':
      return translate(locale, 'activity.lifecycle.startingSoon');
    case 'full':
      return translate(locale, 'activity.lifecycle.full');
    case 'spots_left':
      return spotsLeft === 1
        ? translate(locale, 'activity.lifecycle.oneSpot')
        : translate(locale, 'activity.lifecycle.spots', { count: spotsLeft ?? 0 });
    case 'upcoming':
      return translate(locale, 'activity.lifecycle.upcoming');
  }
}

export function relationshipLabel(relationship: ActivityRelationship): string | null {
  const locale = currentAppLocale();
  if (relationship === 'hosting') return translate(locale, 'activity.relationship.hosting');
  if (relationship === 'joined') return translate(locale, 'activity.relationship.joined');
  return null;
}

/** Kept for callers that intentionally want a compact exceptional-state
 * view. Phase 1a's primary activity surfaces use resolveBadges(), which
 * exposes the complete lifecycle including Upcoming. */
export function shouldShowLifecycleBadge(lifecycle: ActivityLifecycle): boolean {
  return lifecycle !== 'upcoming';
}

/** At most ONE lifecycle badge and ONE relationship badge, and never a
 *  relationship badge on a finished/cancelled activity where "Hosting"
 *  reads as if it were still happening. This is the anti-badge-overload
 *  rule, kept here so every surface obeys it identically. */
export function resolveBadges(
  input: LifecycleInput,
  relationship: ActivityRelationship,
  now: Date = new Date(),
): { lifecycle: string | null; relationship: string | null } {
  const lifecycle = resolveLifecycle(input, now);
  const isOver = lifecycle === 'cancelled' || lifecycle === 'completed';
  return {
    lifecycle: lifecycleLabel(lifecycle, resolveSpotsLeft(input)),
    relationship: isOver ? null : relationshipLabel(relationship),
  };
}
