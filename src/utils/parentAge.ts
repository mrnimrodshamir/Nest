/** Parent age for the public trust context.
 *
 *  PRIVACY RULE: the birthdate itself is NEVER public. `profiles.birthdate`
 *  stays private and only this derived integer reaches another user's screen —
 *  the same treatment children's ages already get via coarse_age_months().
 *
 *  An age is a useful, low-resolution trust signal ("27 · Dad of 3"). A
 *  birthdate is an identifier, and identifiers do not belong on a public
 *  profile. */

/** Whole years since `birthdate`, or null when it cannot be trusted.
 *
 *  Returns null — never 0 or a placeholder — for anything unusable, so callers
 *  omit the age entirely rather than rendering an empty slot. */
export function parentAgeYears(
  birthdate: string | null | undefined,
  now: Date = new Date(),
): number | null {
  if (!birthdate) return null;

  const born = new Date(birthdate);
  const t = born.getTime();
  if (!Number.isFinite(t)) return null;

  // A future birthdate is corrupt data, not a negative age.
  if (t > now.getTime()) return null;

  let age = now.getUTCFullYear() - born.getUTCFullYear();
  // Not yet had this year's birthday.
  const monthDelta = now.getUTCMonth() - born.getUTCMonth();
  if (monthDelta < 0 || (monthDelta === 0 && now.getUTCDate() < born.getUTCDate())) {
    age -= 1;
  }

  // Bounds: below 13 an account should not exist, and above 120 the value is
  // certainly bad data. Either way, show nothing rather than something absurd.
  if (age < 13 || age > 120) return null;
  return age;
}

/** True when an age is safe to show. Kept separate so call sites read clearly. */
export function hasDisplayableAge(birthdate: string | null | undefined, now: Date = new Date()): boolean {
  return parentAgeYears(birthdate, now) !== null;
}
