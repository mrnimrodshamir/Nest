import type { ActivityStatus } from '../types/activity';

export interface SplittableActivity {
  id: string;
  startTime: string;
  status: ActivityStatus;
}

/** Cancelled/completed activities are never "upcoming" regardless of their
 *  start time — a host who cancels a future activity should see it move to
 *  Past immediately, not linger in the live "Upcoming" list. */
export function isLiveActivity(activity: Pick<SplittableActivity, 'status'>): boolean {
  return activity.status !== 'cancelled' && activity.status !== 'completed';
}

export interface SplitMyActivities<T extends SplittableActivity> {
  /** Soonest first. */
  upcoming: T[];
  /** Most recent first. */
  past: T[];
}

/** Splits My Activities into Upcoming/Past. `now` is injectable for tests. */
export function splitMyActivities<T extends SplittableActivity>(
  activities: T[],
  now: Date = new Date(),
): SplitMyActivities<T> {
  const nowIso = now.toISOString();
  const upcoming = activities
    .filter((a) => isLiveActivity(a) && a.startTime >= nowIso)
    .sort((a, b) => a.startTime.localeCompare(b.startTime));
  const past = activities
    .filter((a) => !isLiveActivity(a) || a.startTime < nowIso)
    .sort((a, b) => b.startTime.localeCompare(a.startTime));
  return { upcoming, past };
}
