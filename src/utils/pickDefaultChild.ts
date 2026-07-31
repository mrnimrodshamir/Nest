export interface DefaultSelectableChild {
  id: string;
  isDefault: boolean;
}

/** Which child should be pre-selected when a form needs to auto-pick one —
 *  the child explicitly marked default, or the only/first child if none is
 *  marked (e.g. the marked default was since removed). Null when the parent
 *  has no children at all, so callers never auto-select a nonexistent id. */
export function pickDefaultChild<T extends DefaultSelectableChild>(children: T[]): T | null {
  if (children.length === 0) return null;
  return children.find((c) => c.isDefault) ?? children[0];
}
