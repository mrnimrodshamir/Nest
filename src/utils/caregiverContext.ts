import { parentRoleNoun, type ParentRole } from '@/utils/parentRole';

export interface CaregiverContextInput {
  neighborhood?: string | null;
  parentRole?: ParentRole;
  childCount?: number | null;
  occupation?: string | null;
  bio?: string | null;
}

export interface CaregiverContextLines {
  /** "Florentin · Mom of 2" — area and/or role+count, whichever exist. */
  context: string | null;
  /** "Product Designer" — omitted entirely when absent. */
  occupation: string | null;
  /** Trimmed bio, omitted when blank. */
  bio: string | null;
}

/** "Mom of 2" / "Dad of 1" / "Parent" (when no children are known).
 *
 *  Uses a COUNT rather than a name list. A parent of three rendered as
 *  "Mom of Go, Yo and Zo" produces an awkward, wrapping line in a compact
 *  card, and names carry more identifying detail than the count a stranger
 *  actually needs before deciding to meet someone. Names are still available
 *  separately for surfaces that legitimately show them. */
export function parentRoleWithCount(role: ParentRole, childCount: number | null | undefined): string {
  const noun = parentRoleNoun(role);
  const count = childCount ?? 0;
  return count > 0 ? `${noun} of ${count}` : noun;
}

/** Builds the compact caregiver block, omitting anything absent so the UI
 *  never renders an empty label or a dangling separator.
 *
 *    area + role  -> "Florentin · Mom of 2"
 *    role only    -> "Mom of 2"
 *    area only    -> "Florentin"
 *    neither      -> null (caller renders nothing) */
export function buildCaregiverContext(input: CaregiverContextInput): CaregiverContextLines {
  const area = input.neighborhood?.trim() || null;
  const hasChildren = (input.childCount ?? 0) > 0;
  // A role line is only worth showing when it says something: either a real
  // count, or a role the user actually chose.
  const roleLine = hasChildren || input.parentRole
    ? parentRoleWithCount(input.parentRole ?? null, input.childCount)
    : null;

  const contextParts = [area, roleLine].filter(Boolean) as string[];

  return {
    context: contextParts.length ? contextParts.join(' · ') : null,
    occupation: input.occupation?.trim() || null,
    bio: input.bio?.trim() || null,
  };
}
