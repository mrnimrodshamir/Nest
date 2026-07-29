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

export function birthdateToYearsMonths(isoDate: string, now: Date = new Date()): { years: number; months: number } {
  const totalMonths = birthdateToMonths(isoDate, now);
  return { years: Math.floor(totalMonths / 12), months: totalMonths % 12 };
}

/** `now` defaults to the device's current date/time — pass an explicit
 *  value only for deterministic testing of age boundaries. */
export function birthdateToMonths(isoDate: string, now: Date = new Date()): number {
  const birth = new Date(isoDate);
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
