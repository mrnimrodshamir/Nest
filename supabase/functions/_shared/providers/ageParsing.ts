/** Hebrew age-range text → months. Conservative on purpose: an unrecognized
 *  pattern returns null/null (unknown), never a guess. A parent filtering by
 *  "0-2" must never see a workshop that was actually "8-12" because a regex
 *  half-matched something. */
export interface ParsedAgeRange {
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
}

const UNKNOWN: ParsedAgeRange = { ageMinMonths: null, ageMaxMonths: null };

// "3-6 חודשים" / "חודשים 3-6" — explicit months, checked first so a range
// this small is never misread as years.
const MONTH_RANGE = /(\d{1,2})\s*-\s*(\d{1,2})\s*חודש/;
// "לגילי 6-3" / "לגילאי 3-6" / "גילאי 3-6" — the source writes these in
// either order, so the parser always takes min()/max() of the two numbers
// rather than trusting position.
const YEAR_RANGE = /לגיל(?:אי|י)?\s*(\d{1,2})\s*-\s*(\d{1,2})|גילאי\s*(\d{1,2})\s*-\s*(\d{1,2})/;
const FROM_AGE_YEARS = /מגיל\s*(\d{1,2})(?!\s*-)/;
const UP_TO_AGE_YEARS = /עד\s*גיל\s*(\d{1,2})/;

export function parseHebrewAgeRange(raw: string | null | undefined): ParsedAgeRange {
  if (!raw) return UNKNOWN;
  const text = raw.trim();
  if (!text) return UNKNOWN;

  const monthMatch = text.match(MONTH_RANGE);
  if (monthMatch) return monthRange(Number(monthMatch[1]), Number(monthMatch[2]));

  const yearMatch = text.match(YEAR_RANGE);
  if (yearMatch) {
    const a = Number(yearMatch[1] ?? yearMatch[3]);
    const b = Number(yearMatch[2] ?? yearMatch[4]);
    return yearRange(a, b);
  }

  const fromMatch = text.match(FROM_AGE_YEARS);
  if (fromMatch) return { ageMinMonths: Number(fromMatch[1]) * 12, ageMaxMonths: null };

  const upToMatch = text.match(UP_TO_AGE_YEARS);
  if (upToMatch) return { ageMinMonths: null, ageMaxMonths: Number(upToMatch[1]) * 12 };

  return UNKNOWN;
}

function monthRange(a: number, b: number): ParsedAgeRange {
  return { ageMinMonths: Math.min(a, b), ageMaxMonths: Math.max(a, b) };
}

function yearRange(a: number, b: number): ParsedAgeRange {
  return { ageMinMonths: Math.min(a, b) * 12, ageMaxMonths: Math.max(a, b) * 12 };
}
