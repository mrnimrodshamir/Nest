import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  birthdateToMonths,
  birthdateToYearsMonths,
  formatBabyAge,
  formatAgeRange,
  yearsMonthsToBirthdate,
} from './babyAge.ts';

test('newborn — born today', () => {
  const now = new Date(2026, 5, 15);
  assert.equal(birthdateToMonths('2026-06-15', now), 0);
  assert.equal(formatBabyAge(birthdateToMonths('2026-06-15', now)), 'Newborn');
});

test('newborn — a few weeks old, under 1 month', () => {
  const now = new Date(2026, 5, 15);
  assert.equal(birthdateToMonths('2026-05-25', now), 0);
  assert.equal(formatBabyAge(0), 'Newborn');
});

test('exactly 1 month old', () => {
  const now = new Date(2026, 5, 15); // Jun 15
  assert.equal(birthdateToMonths('2026-05-15', now), 1);
  assert.equal(formatBabyAge(1), '1mo');
});

test('11 months old', () => {
  const now = new Date(2026, 5, 15); // Jun 15 2026
  assert.equal(birthdateToMonths('2025-07-15', now), 11);
  assert.equal(formatBabyAge(11), '11mo');
});

test('exactly 1 year old', () => {
  const now = new Date(2026, 5, 15); // Jun 15 2026
  assert.equal(birthdateToMonths('2025-06-15', now), 12);
  assert.equal(formatBabyAge(12), '1y');
});

test('1 year and 1 month old', () => {
  const now = new Date(2026, 6, 20); // Jul 20 2026
  assert.equal(birthdateToMonths('2025-06-15', now), 13);
  assert.equal(formatBabyAge(13), '1y 1mo');
  assert.deepEqual(birthdateToYearsMonths('2025-06-15', now), { years: 1, months: 1 });
});

test('leap-day birthday — day before the anniversary in a non-leap year', () => {
  // Born Feb 29, 2024 (leap year). On Feb 28, 2025 (non-leap year, no Feb 29
  // exists), the anniversary day hasn't been reached yet.
  const now = new Date(2025, 1, 28);
  assert.equal(birthdateToMonths('2024-02-29', now), 11);
});

test('leap-day birthday — the day after, in a non-leap year', () => {
  const now = new Date(2025, 2, 1); // Mar 1, 2025
  assert.equal(birthdateToMonths('2024-02-29', now), 12);
});

test('leap-day birthday — on an actual leap year anniversary', () => {
  const now = new Date(2028, 1, 29); // Feb 29, 2028 (leap year)
  assert.equal(birthdateToMonths('2024-02-29', now), 48);
});

test('end-of-month birthday — short month hasn’t reached the day yet', () => {
  // Born Jan 31. By Feb 28 (Feb never reaches day 31), the 1-month mark
  // hasn't been reached — this is the conservative, correct interpretation
  // (never overstates age), not a days/30 approximation.
  const now = new Date(2026, 1, 28); // Feb 28, 2026
  assert.equal(birthdateToMonths('2026-01-31', now), 0);
});

test('end-of-month birthday — reached once the next applicable month arrives', () => {
  const now = new Date(2026, 2, 31); // Mar 31, 2026
  assert.equal(birthdateToMonths('2026-01-31', now), 2);
});

test('never returns a negative age for a birthdate in the future', () => {
  const now = new Date(2026, 0, 1);
  assert.equal(birthdateToMonths('2026-06-15', now), 0);
});

test('formatAgeRange handles open-ended and bounded ranges', () => {
  assert.equal(formatAgeRange(null, null), 'Any age');
  assert.equal(formatAgeRange(0, 12), 'Newborn–1y');
  assert.equal(formatAgeRange(6, null), '6mo+');
  assert.equal(formatAgeRange(null, 24), 'Up to 2y');
});

test('yearsMonthsToBirthdate round-trips back to the same age', () => {
  const now = new Date(2026, 5, 15);
  const iso = yearsMonthsToBirthdate(1, 4);
  // yearsMonthsToBirthdate always measures from the real current date, so
  // round-trip the computed birthdate against "now" (real time), not the
  // fixed `now` used elsewhere in this file.
  const months = birthdateToMonths(iso);
  assert.equal(months, 16);
});

test('yearsMonthsToBirthdate normalizes 12 months into 1 year (never emits month 12)', () => {
  // The picker UI caps months at 11 (see YearsMonthsPicker), but the
  // conversion itself must still be correct if ever called with 12.
  const iso = yearsMonthsToBirthdate(0, 12);
  const oneYearIso = yearsMonthsToBirthdate(1, 0);
  assert.equal(iso, oneYearIso);
});

test('Hebrew child ages use grammatical relationship and age words', () => {
  assert.equal(formatBabyAge(36, 'he', 'male'), 'בן 3');
  assert.equal(formatBabyAge(25, 'he', 'male'), 'בן שנתיים וחודש');
  assert.equal(formatBabyAge(25, 'he', 'female'), 'בת שנתיים וחודש');
  // With no stored gender the phrase carries the UNIT instead of a prefix.
  // This used to be 'גיל 8 חודשים' — grammatical, but the register of a form
  // field rather than of one parent describing their child to another.
  assert.equal(formatBabyAge(8, 'he', null), '8 חודשים');
});
