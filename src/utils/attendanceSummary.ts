import { currentAppLocale, translate } from '@/i18n/core';
import { safeCaregiverDisplayName } from '@/utils/profileIdentity';

/** One row as returned by get_activity_attendance(). There is deliberately
 *  NO birthdate field — the RPC returns a pre-coarsened age in months
 *  (exact under 2 years, floored to whole years above) so another user's
 *  child's date of birth never reaches any client.
 *  See supabase/migrations/0004_child_age_privacy.sql. */
export interface AttendanceRow {
  source: 'host' | 'attendee';
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  coming_alone: boolean;
  child_id: string | null;
  child_name: string | null;
  child_age_months: number | null;
}

export interface PersonAttendance {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  isHost: boolean;
  comingAlone: boolean;
  /** Child first names in row order, deduplicated. */
  childNames: string[];
  /** Participants-section copy: "With Go" / "With Go and Yo" / "Coming alone". */
  withLabel: string;
  /** Longer copy used where a single child's age adds context. */
  summary: string;
}

/** Groups the flat RPC result into one entry per person.
 *
 *  The RPC returns one row per (person x child), so a parent attending with
 *  two children arrives as two rows — collapsing them here is what prevents
 *  duplicate participant rows in the UI. A person with no children still
 *  produces exactly one row (child_id null), so they are never dropped. */
export function groupAttendance(rows: AttendanceRow[]): PersonAttendance[] {
  const byUser = new Map<string, AttendanceRow[]>();
  for (const row of rows) {
    const list = byUser.get(row.user_id) ?? [];
    list.push(row);
    byUser.set(row.user_id, list);
  }

  const people: PersonAttendance[] = [];
  for (const [userId, personRows] of byUser) {
    const first = personRows[0];
    const isHost = personRows.some((r) => r.source === 'host');
    const comingAlone = first?.coming_alone ?? true;

    // Dedupe by child_id: a duplicated attendance row must not double a name.
    const seen = new Set<string>();
    const childNames: string[] = [];
    for (const row of personRows) {
      if (!row.child_id || !row.child_name || seen.has(row.child_id)) continue;
      seen.add(row.child_id);
      childNames.push(row.child_name);
    }

    const ageMonths = personRows.find((r) => r.child_id)?.child_age_months ?? null;

    people.push({
      userId,
      displayName: safeCaregiverDisplayName(first?.display_name),
      avatarUrl: first?.avatar_url ?? null,
      isHost,
      comingAlone,
      childNames,
      withLabel: buildWithLabel(comingAlone, childNames),
      summary: buildSummary(comingAlone, childNames, ageMonths),
    });
  }

  // Host always first; remaining participants keep RPC order.
  return people.sort((a, b) => Number(b.isHost) - Number(a.isHost));
}

/** "With Go" / "With Go and Yo" / "With Go, Yo and Zo" / "Coming alone". */
export function buildWithLabel(comingAlone: boolean, childNames: string[]): string {
  const locale = currentAppLocale();
  if (comingAlone || childNames.length === 0) return translate(locale, 'activity.attendance.comingAlone');
  if (childNames.length === 1) return translate(locale, 'activity.attendance.withOne', { first: childNames[0] });
  if (childNames.length === 2) return translate(locale, 'activity.attendance.withTwo', { first: childNames[0], second: childNames[1] });
  return translate(locale, 'activity.attendance.withMore', { names: childNames.slice(0, -1).join(', '), last: childNames[childNames.length - 1] });
}

function buildSummary(
  comingAlone: boolean,
  childNames: string[],
  ageMonths: number | null,
): string {
  if (comingAlone || childNames.length === 0) return 'coming alone';
  if (childNames.length === 1) {
    const age = formatAttendanceAge(ageMonths);
    return age ? `coming with ${childNames[0]}, ${age}` : `coming with ${childNames[0]}`;
  }
  return `coming with ${childNames.length} children`;
}

/** Attendance exposes only the precision rendered here. Under two years
 * remains month-based; from two years onward the RPC has already floored the
 * value to a whole-year multiple of 12. */
export function formatAttendanceAge(months: number | null): string | null {
  if (months === null) return null;
  const locale = currentAppLocale();
  if (months < 1) return translate(locale, 'age.newborn');
  if (months < 24) return translate(locale, 'age.months', { count: months });
  return translate(locale, 'age.years', { count: Math.floor(months / 12) });
}

/** Participant counting for the "Participants · 4/8" header. The host is
 *  always a participant; capacity null means uncapped. */
export function resolveParticipantCounts(
  people: PersonAttendance[],
  capacity: number | null,
): { count: number; capacity: number | null; spotsLeft: number | null } {
  const count = people.length;
  return {
    count,
    capacity,
    spotsLeft: capacity === null ? null : Math.max(0, capacity - count),
  };
}
