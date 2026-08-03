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

export interface ChildLike {
  name: string;
}

/** How many names are spelled out before collapsing to a "+N" remainder. */
const MAX_NAMED = 2;

export function formatParentSubtitle(children: readonly ChildLike[] | null | undefined): string | undefined {
  if (!children || children.length === 0) return undefined;

  // Defensive: a child mid-creation can have a blank name; excluding it
  // keeps the copy from rendering "Parent of  and Yo".
  const names = children.map((c) => c?.name?.trim()).filter((n): n is string => Boolean(n));
  if (names.length === 0) return undefined;

  if (names.length === 1) return `Parent of ${names[0]}`;
  if (names.length === 2) return `Parent of ${names[0]} and ${names[1]}`;

  const shown = names.slice(0, MAX_NAMED).join(', ');
  return `Parent of ${shown} +${names.length - MAX_NAMED}`;
}
