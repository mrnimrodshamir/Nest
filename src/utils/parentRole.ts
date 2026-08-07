/** Self-selected parent role. NEVER inferred — not from name, photo, child,
 *  relationship, or anything else. `null` is a first-class value meaning "the
 *  user has not chosen", and it renders as the neutral "Parent".
 *
 *  SCHEMA STATE: `profiles.parent_role` does NOT exist in production yet
 *  (verified against ghzpzimcxvccbmjsttlf — profiles has avatar_url, bio,
 *  created_at, display_name, due_date, email, id, location,
 *  neighborhood_label, notification_preferences, onboarding_completed, phone,
 *  updated_at, verified_at). The migration is prepared locally and NOT
 *  applied; until it lands every caller passes null and copy reads "Parent",
 *  which is exactly the current behaviour — so this module is safe to ship
 *  ahead of the migration. */
export type ParentRole = 'mom' | 'dad' | 'parent' | null;

const ROLE_NOUN: Record<'mom' | 'dad' | 'parent', string> = {
  mom: 'Mom',
  dad: 'Dad',
  parent: 'Parent',
};

/** "Mom" / "Dad" / "Parent". Unknown or null always degrades to "Parent". */
export function parentRoleNoun(role: ParentRole): string {
  if (role === 'mom' || role === 'dad' || role === 'parent') return ROLE_NOUN[role];
  return ROLE_NOUN.parent;
}

/** Whether a stored value is a role we recognise. Guards against a future
 *  enum value arriving from the DB before the client knows about it. */
export function isParentRole(value: unknown): value is Exclude<ParentRole, null> {
  return value === 'mom' || value === 'dad' || value === 'parent';
}

/** Normalises anything the DB might return into a safe ParentRole. */
export function coerceParentRole(value: unknown): ParentRole {
  return isParentRole(value) ? value : null;
}

/** Child-list copy, preserving the previously approved concise format:
 *    1 child   -> "Mom of Go"
 *    2 children-> "Mom of Go and Yo"
 *    3+        -> "Mom of Go, Yo +1"   (+N counts ALL remaining children)
 *  Zero children returns just the role noun, never "Parent of" with nothing. */
export function parentOfLabel(role: ParentRole, childNames: string[]): string {
  const noun = parentRoleNoun(role);
  const names = childNames.filter((n) => n && n.trim()).map((n) => n.trim());
  if (names.length === 0) return noun;
  if (names.length === 1) return `${noun} of ${names[0]}`;
  if (names.length === 2) return `${noun} of ${names[0]} and ${names[1]}`;
  return `${noun} of ${names[0]}, ${names[1]} +${names.length - 2}`;
}

/** Compact trust line for a caregiver card:
 *    "Florentin · 2 children"
 *    "Florentin · 1 child"
 *    "2 children"                (no area known)
 *    ""                          (nothing safe to show)
 *  Deliberately uses a COUNT, not names, and a neighbourhood label, never
 *  coordinates — this line is shown to people who have not met the user. */
export function trustContextLine(input: {
  neighborhood?: string | null;
  childCount?: number | null;
}): string {
  const parts: string[] = [];
  const area = input.neighborhood?.trim();
  if (area) parts.push(area);
  const count = input.childCount ?? 0;
  if (count > 0) parts.push(count === 1 ? '1 child' : `${count} children`);
  return parts.join(' · ');
}
