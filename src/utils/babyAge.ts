/** Converts a years+months picker into an estimated date of birth (ISO date).
 *  We only ever ask for years/months in the UI, but always store a DOB so
 *  age can be computed correctly later without re-asking the user. */
export function yearsMonthsToBirthdate(years: number, months: number): string {
  const totalMonths = years * 12 + months;
  const date = new Date();
  date.setDate(1); // avoid month-length overflow (e.g. Jan 31 -> Mar 3)
  date.setMonth(date.getMonth() - totalMonths);
  return date.toISOString().slice(0, 10);
}

export function birthdateToYearsMonths(isoDate: string): { years: number; months: number } {
  const totalMonths = birthdateToMonths(isoDate);
  return { years: Math.floor(totalMonths / 12), months: totalMonths % 12 };
}

export function birthdateToMonths(isoDate: string): number {
  const birth = new Date(isoDate);
  const now = new Date();
  let months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
  if (now.getDate() < birth.getDate()) months -= 1;
  return Math.max(0, months);
}

export function formatBabyAge(months: number | null): string {
  if (months === null) return '';
  if (months < 1) return 'Newborn';
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  if (years === 0) return `${remMonths}mo`;
  if (remMonths === 0) return `${years}y`;
  return `${years}y ${remMonths}mo`;
}

export function formatAgeRange(minMonths: number | null, maxMonths: number | null): string {
  if (minMonths === null && maxMonths === null) return 'Any age';
  if (minMonths !== null && maxMonths !== null) {
    return `${formatBabyAge(minMonths)}–${formatBabyAge(maxMonths)}`;
  }
  if (minMonths !== null) return `${formatBabyAge(minMonths)}+`;
  return `Up to ${formatBabyAge(maxMonths)}`;
}
