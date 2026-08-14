/** Family relevance filter for municipal records.
 *
 *  NestUp mirrors the part of the Tel Aviv feed a parent could plausibly attend
 *  with a small child — not the whole municipal calendar. The filter is
 *  deliberately keyword-based and deliberately conservative: it is easier to
 *  explain to a municipality why a specific event was excluded than to explain
 *  why a city-council budget hearing appeared in a parenting app.
 *
 *  WHY NOT A HARDCODED PASS-LIST. The previous activation path carried an
 *  explicit set of transport ids that had been eyeballed once. That cannot
 *  survive automation: the next sync brings records nobody has seen, and an
 *  id-based allow-list rejects all of them. Rules have to generalise.
 *
 *  Hebrew first — the source is Hebrew. English terms are included because some
 *  records carry transliterated or bilingual titles.
 */

/** Terms that make a record plausibly family-relevant. */
const INCLUDE_TERMS: readonly string[] = [
  // Hebrew: children / family
  'ילד', 'ילדים', 'ילדות', 'תינוק', 'תינוקות', 'פעוט', 'פעוטות', 'משפח', 'הורים',
  'הורה', 'אמהות', 'אבות', 'אמא', 'אבא', 'חופשת לידה', 'לידה', 'הריון', 'גן ילדים',
  // Hebrew: the activity kinds parents actually go to
  'סיפור', 'שעת סיפור', 'הצגה', 'הצגות', 'סדנה', 'סדנת', 'סדנאות', 'יצירה',
  'מוזיאון', 'ספריה', 'ספרייה', 'פארק', 'גינה', 'משחק', 'משחקים', 'מגרש משחקים',
  'טיול', 'פסטיבל', 'מופע', 'תיאטרון', 'קרנבל', 'חוג', 'התעמלות', 'שחייה',
  // English equivalents for bilingual records
  'child', 'children', 'kid', 'kids', 'baby', 'babies', 'toddler', 'family',
  'families', 'parent', 'parents', 'story time', 'storytime', 'workshop',
  'museum', 'library', 'park', 'playground', 'puppet', 'stroller',
];

/** Broad activity words are useful only when the same record also identifies a
 * family audience. Without this guard, an adult concert ("מופע") or a true-crime
 * podcast ("סיפור") is accidentally published. */
const AUDIENCE_TERMS: readonly string[] = [
  'ילד', 'ילדים', 'ילדות', 'תינוק', 'תינוקות', 'פעוט', 'פעוטות', 'משפח', 'הורים',
  'הורה', 'אמהות', 'אבות', 'אמא', 'אבא', 'חופשת לידה', 'גן ילדים',
  'child', 'children', 'kid', 'kids', 'baby', 'babies', 'toddler', 'family', 'families',
  'parent', 'parents', 'stroller',
];
const AUDIENCE_PREFIXES: readonly string[] = ['ילד', 'תינוק', 'פעוט', 'משפח'];
const ENGLISH_AUDIENCE_PREFIXES: readonly string[] = ['child', 'kid', 'baby', 'toddler', 'famil', 'parent', 'stroller'];
const ADDITIONAL_HEBREW_AUDIENCE_TERMS: readonly string[] = ['\u05dc\u05d9\u05d3\u05d4', '\u05d4\u05e8\u05d9\u05d5\u05df'];

const BROAD_ACTIVITY_TERMS: readonly string[] = [
  'סיפור', 'הצגה', 'הצגות', 'סדנה', 'סדנת', 'סדנאות', 'יצירה', 'טיול', 'פסטיבל',
  'מופע', 'תיאטרון', 'קרנבל', 'חוג', 'התעמלות', 'שחייה',
  'story time', 'storytime', 'workshop', 'puppet',
];

/** Terms that mark a record as clearly not for parents with small children,
 *  even if an include term also appears. Municipal feeds mix audiences freely:
 *  "עירוני" alone means nothing, but a tender or a council meeting is never a
 *  family outing. */
const EXCLUDE_TERMS: readonly string[] = [
  'מכרז', 'מכרזים', 'ועדה', 'ועדת', 'מועצת העיר', 'ישיבת מועצה', 'תקציב',
  'הודעה לתושבים', 'חסימת כביש', 'עבודות', 'הפסקת מים', 'גיוס', 'משרה',
  'בחירות', 'תעריף', 'ארנונה', 'שימוע', 'התנגדויות',
  'tender', 'council meeting', 'road closure', 'water outage', 'vacancy',
  'municipal committee', 'budget hearing',
  // Adult-only contexts
  'יין', 'בירה', 'אלכוהול', 'פאב', 'מסיבת רווקים', '18+', '21+',
  'wine tasting', 'beer festival', 'nightlife', 'adults only',
];

export type RelevanceDecision =
  | { relevant: true; matched: string[] }
  | { relevant: false; reason: 'excluded_term'; matched: string[] }
  | { relevant: false; reason: 'no_family_signal'; matched: [] };

/** Decides whether a normalized record belongs in NestUp.
 *
 *  Exclusion wins over inclusion: "סדנת יין להורים" (a wine workshop for
 *  parents) matches both, and is not something to put in front of a parent
 *  looking for somewhere to take a toddler. */
export function assessFamilyRelevance(input: {
  title: string;
  description?: string | null;
  sourceType?: string | null;
  locationName?: string | null;
}): RelevanceDecision {
  const haystack = [input.title, input.description, input.sourceType, input.locationName]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' ')
    .toLowerCase();

  const excluded = EXCLUDE_TERMS.filter((term) => haystack.includes(term.toLowerCase()));
  if (excluded.length > 0) return { relevant: false, reason: 'excluded_term', matched: excluded };

  const matched = INCLUDE_TERMS.filter((term) => haystack.includes(term.toLowerCase()));
  if (matched.length === 0) return { relevant: false, reason: 'no_family_signal', matched: [] };

  const tokens = new Set(haystack.normalize('NFKC').split(/[\s\p{P}\p{S}]+/u).filter(Boolean));
  const audienceTokens = new Set([...tokens].flatMap(hebrewPrefixVariants));
  const audienceMatched = [...AUDIENCE_TERMS, ...ADDITIONAL_HEBREW_AUDIENCE_TERMS].some((term) => {
    const normalized = term.toLowerCase().normalize('NFKC');
    return normalized.includes(' ') ? haystack.includes(normalized) : audienceTokens.has(normalized);
  }) || [...audienceTokens].some((token) =>
    AUDIENCE_PREFIXES.some((prefix) => token.startsWith(prefix))
    || ENGLISH_AUDIENCE_PREFIXES.some((prefix) => token.startsWith(prefix))
  );
  const specificVenueMatched = ['מוזיאון', 'ספריה', 'ספרייה', 'פארק', 'גינה', 'מגרש משחקים', 'museum', 'library', 'park', 'playground']
    .some((term) => haystack.includes(term.toLowerCase()));
  const onlyBroadSignal = matched.every((term) => BROAD_ACTIVITY_TERMS.includes(term));
  if (!audienceMatched && !specificVenueMatched && onlyBroadSignal) {
    return { relevant: false, reason: 'no_family_signal', matched: [] };
  }
  if (!audienceMatched && !specificVenueMatched) {
    return { relevant: false, reason: 'no_family_signal', matched: [] };
  }

  return { relevant: true, matched };
}

/** Hebrew attaches common conjunctions/prepositions/articles directly to a
 * word. Keep the original token and safely peel up to two one-letter clitics,
 * so child/family terms still match with common prefixes. */
function hebrewPrefixVariants(token: string): string[] {
  const variants = [token];
  let current = token;
  for (let depth = 0; depth < 2 && current.length > 3 && /^[\u05d5\u05d4\u05d1\u05db\u05dc\u05de]/u.test(current); depth += 1) {
    current = current.slice(1);
    variants.push(current);
  }
  return variants;
}

export function isFamilyRelevant(input: Parameters<typeof assessFamilyRelevance>[0]): boolean {
  return assessFamilyRelevance(input).relevant;
}

/** The pre-automation rule retained only for deterministic reconciliation.
 * It answers whether the exact same provider row would have passed before the
 * audience guard was introduced; it is never used to publish new content. */
export function assessLegacyFamilyRelevance(input: Parameters<typeof assessFamilyRelevance>[0]): RelevanceDecision {
  const haystack = [input.title, input.description, input.sourceType, input.locationName]
    .filter((part): part is string => typeof part === 'string' && part.length > 0)
    .join(' ')
    .toLowerCase();
  const excluded = EXCLUDE_TERMS.filter((term) => haystack.includes(term.toLowerCase()));
  if (excluded.length > 0) return { relevant: false, reason: 'excluded_term', matched: excluded };
  const matched = INCLUDE_TERMS.filter((term) => haystack.includes(term.toLowerCase()));
  return matched.length > 0
    ? { relevant: true, matched }
    : { relevant: false, reason: 'no_family_signal', matched: [] };
}
