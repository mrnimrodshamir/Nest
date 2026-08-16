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

export function formatBabyAge(
  months: number | null,
  locale: AppLocale = currentAppLocale(),
  sex: ChildSex | null = null,
): string {
  if (months === null) return '';
  if (months < 1) return translate(locale, 'age.newborn');
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  if (locale === 'he') return formatHebrewChildAge(years, remMonths, sex);
  if (years === 0) return translate(locale, 'age.months', { count: remMonths });
  if (remMonths === 0) return translate(locale, 'age.years', { count: years });
  return translate(locale, 'age.yearsMonths', { years, months: remMonths });
}

export function formatAgeRange(minMonths: number | null, maxMonths: number | null): string {
  const locale = currentAppLocale();
  if (minMonths === null && maxMonths === null) return translate(locale, 'age.any');
  if (minMonths !== null && maxMonths !== null) {
    return translate(locale, 'age.range', { min: formatBabyAge(minMonths, locale), max: formatBabyAge(maxMonths, locale) });
  }
  if (minMonths !== null) return translate(locale, 'age.andUp', { age: formatBabyAge(minMonths, locale) });
  return translate(locale, 'age.upTo', { age: formatBabyAge(maxMonths, locale) });
}

function formatHebrewChildAge(years: number, months: number, sex: ChildSex | null): string {
  const prefix = translate('he', sex === 'male' ? 'age.he.prefix.male' : sex === 'female' ? 'age.he.prefix.female' : 'age.he.prefix.neutral');
  const monthLabel = translate('he', months === 1 ? 'age.he.month.one' : months === 2 ? 'age.he.month.two' : 'age.he.month.other', { count: months });
  if (years === 0) return translate('he', 'age.he.withPrefix', { prefix, age: monthLabel });
  const yearLabel = translate('he', years === 1 ? 'age.he.year.one' : years === 2 ? 'age.he.year.two' : 'age.he.year.other', { count: years });
  return translate('he', months === 0 ? 'age.he.withPrefix' : 'age.he.yearsMonths', { prefix, age: yearLabel, years: yearLabel, months: monthLabel });
}
import { currentAppLocale, translate, type AppLocale } from '@/i18n/core';
import type { ChildSex } from '@/types/child';
