/** Profile identity copy describing the whole children list.
 *
 *  PRODUCT RULE (one consistent format, documented here as the source of
 *  truth so Profile, Public Profile and any future surface agree):
 *    0 children -> undefined (render no subtitle; never "Parent of undefined")
 *    1 child    -> "Parent of Go"
 *    2 children -> "Parent of Go and Yo"
 *    3+         -> "Parent of Go, Yo +2"
 *
 *  Deliberately built from the FULL list in stored order — never
 *  `children[0]` and never the default child. The default-child concept is
 *  for activity/matching defaults only; using it for identity copy hid the
 *  user's other children, which is the bug this replaces. */

import { parentRoleNoun, type ParentRole } from '@/utils/parentRole';
import type { Translator } from '@/i18n/taxonomy';
import { isolateText } from '@/i18n/rtl';

export interface ChildLike {
  name: string;
}

/** How many names are spelled out before collapsing to a "+N" remainder. */
const MAX_NAMED = 2;

export function formatParentSubtitle(
  children: readonly ChildLike[] | null | undefined,
  /** The role the user selected for themselves. Null renders the neutral
   *  "Parent". NEVER inferred — this function has no input from which it
   *  could guess, and that is deliberate. */
  role: ParentRole = null,
  t?: Translator,
): string | undefined {
  if (!children || children.length === 0) return undefined;

  // Defensive: a child mid-creation can have a blank name; excluding it
  // keeps the copy from rendering "Parent of  and Yo".
  const names = children.map((c) => c?.name?.trim()).filter((n): n is string => Boolean(n));
  if (names.length === 0) return undefined;

  // Previously hardcoded "Parent" here, so a user who had selected Dad in Edit
  // Profile still read "Parent of ..." on their profile. The role now flows
  // through from the stored value.
  const noun = parentRoleNoun(role);

  if (t) {
    const roleLabel = t(`profile.role.${role ?? 'parent'}` as Parameters<Translator>[0]);
    const safeNames = names.map(isolateText);
    if (safeNames.length === 1) return t('profile.parentOf.one', { role: roleLabel, first: safeNames[0] });
    if (safeNames.length === 2) return t('profile.parentOf.two', { role: roleLabel, first: safeNames[0], second: safeNames[1] });
    return t('profile.parentOf.more', {
      role: roleLabel,
      first: safeNames[0],
      second: safeNames[1],
      count: safeNames.length - MAX_NAMED,
    });
  }

  if (names.length === 1) return `${noun} of ${names[0]}`;
  if (names.length === 2) return `${noun} of ${names[0]} and ${names[1]}`;

  const shown = names.slice(0, MAX_NAMED).join(', ');
  return `${noun} of ${shown} +${names.length - MAX_NAMED}`;
}
