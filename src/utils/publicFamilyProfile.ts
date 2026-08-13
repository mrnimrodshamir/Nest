export const PROFILE_BIO_MAX_LENGTH = 300;

export interface PublicChildPresentation {
  name: string;
  ageMonths: number | null;
  ageKey: 'profile.childAge.newborn' | 'profile.childAge.month.one' | 'profile.childAge.month.other' | 'profile.childAge.year.one' | 'profile.childAge.year.other' | null;
  ageCount: number | null;
}

/** Zips the privacy-safe arrays exposed by public_profiles. No birthdate is
 * accepted, so callers cannot accidentally render one. */
export function buildPublicChildren(
  names: readonly string[] | null | undefined,
  agesMonths: readonly (number | null)[] | null | undefined,
): PublicChildPresentation[] {
  const result: PublicChildPresentation[] = [];
  (names ?? []).forEach((rawName, index) => {
    const name = rawName.trim();
    if (!name) return;
    const rawAge = agesMonths?.[index];
    const ageMonths = typeof rawAge === 'number' && Number.isFinite(rawAge) && rawAge >= 0
      ? Math.floor(rawAge)
      : null;
    if (ageMonths === null) {
      result.push({ name, ageMonths, ageKey: null, ageCount: null });
      return;
    }
    if (ageMonths === 0) {
      result.push({ name, ageMonths, ageKey: 'profile.childAge.newborn', ageCount: 0 });
      return;
    }
    if (ageMonths < 24) {
      result.push({
        name,
        ageMonths,
        ageKey: ageMonths === 1 ? 'profile.childAge.month.one' : 'profile.childAge.month.other',
        ageCount: ageMonths,
      });
      return;
    }
    const years = Math.floor(ageMonths / 12);
    result.push({
      name,
      ageMonths,
      ageKey: years === 1 ? 'profile.childAge.year.one' : 'profile.childAge.year.other',
      ageCount: years,
    });
  });
  return result;
}

export function normalizeOptionalProfileText(value: string | null | undefined): string | null {
  return value?.trim() || null;
}

export function normalizeProfileBio(value: string | null | undefined): string | null {
  const normalized = normalizeOptionalProfileText(value);
  return normalized ? normalized.slice(0, PROFILE_BIO_MAX_LENGTH) : null;
}
