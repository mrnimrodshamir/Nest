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
  /* The combined form joins parts that are ALREADY pluralized, rather than
     interpolating bare numbers into one template. That template could not be
     right in French for both 1 and 2 years, which is how "1 ans" reached the
     screen. */
  const yearsLabel = translate(locale, years === 1 ? 'age.years.one' : 'age.years', { count: years });
  const monthsLabel = translate(locale, remMonths === 1 ? 'age.months.one' : 'age.months', { count: remMonths });
  if (years === 0) return monthsLabel;
  if (remMonths === 0) return yearsLabel;
  // A plain space join, not a dictionary template: the two operands are
  // already-localized, already-pluralized labels, so there is nothing left
  // for a per-locale template to decide — every locale joins them the same
  // way ("2 ans 1 mois", "2 г. 1 мес.", "2y 1mo").
  return `${yearsLabel} ${monthsLabel}`;
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

/** Hebrew child age.
 *
 *  Hebrew has no gender-neutral way to say "aged N" about a person, so the
 *  shape of the phrase depends on whether the child's gender is stored:
 *
 *    known    "בן 3" / "בת 3"            — prefix carries the grammar, and the
 *                                          unit is dropped because that is how
 *                                          it is actually said
 *    unknown  "3 שנים" / "6 חודשים"      — no prefix at all, the unit carries
 *                                          the meaning
 *
 *  The previous neutral form was the literal prefix "גיל", which produced
 *  "גיל 4 חודשים" — grammatical, but the register of a form field rather than
 *  of one parent telling another how old their child is. Gender is never
 *  guessed: an absent value takes the neutral branch. */
function formatHebrewChildAge(years: number, months: number, sex: ChildSex | null): string {
  const gendered = sex === 'male' || sex === 'female';
  const monthLabel = translate('he', months === 1 ? 'age.he.month.one' : months === 2 ? 'age.he.month.two' : 'age.he.month.other', { count: months });

  /* The "and" joining years to months takes a maqaf before a numeral and not
     before a word: "שנתיים וחודש" but "3 שנים ו־3 חודשים". Deciding it here
     rather than in the dictionary keeps one template correct for both. */
  const joinedMonths = /^\d/.test(monthLabel) ? `ו־${monthLabel}` : `ו${monthLabel}`;

  if (!gendered) {
    if (years === 0) return monthLabel;
    const yearLabel = translate('he', years === 1 ? 'age.he.yearNeutral.one' : years === 2 ? 'age.he.yearNeutral.two' : 'age.he.yearNeutral.other', { count: years });
    if (months === 0) return yearLabel;
    return `${yearLabel} ${joinedMonths}`;
  }

  const prefix = translate('he', sex === 'male' ? 'age.he.prefix.male' : 'age.he.prefix.female');
  if (years === 0) return translate('he', 'age.he.withPrefix', { prefix, age: monthLabel });
  const yearLabel = translate('he', years === 1 ? 'age.he.year.one' : years === 2 ? 'age.he.year.two' : 'age.he.year.other', { count: years });
  return translate('he', months === 0 ? 'age.he.withPrefix' : 'age.he.yearsMonths', { prefix, age: yearLabel, years: yearLabel, months: joinedMonths });
}
import { currentAppLocale, translate, type AppLocale } from '@/i18n/core';
import type { ChildSex } from '@/types/child';
