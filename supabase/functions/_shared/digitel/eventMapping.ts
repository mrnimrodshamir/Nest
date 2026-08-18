import type { DigitelEventCandidate } from './connector.ts';

export type DigitelEventCategory =
  | 'story_time' | 'workshop' | 'performance' | 'festival' | 'museum'
  | 'library' | 'park' | 'sports' | 'community' | 'animals' | 'other';

export interface DigitelSyncCandidate {
  eligibleForNestupPublication: boolean;
  providerEventId: string;
  providerTransportId: string;
  sourceGroupId: string | null;
  occurrenceId: string;
  occurrenceFingerprint: string;
  title: string;
  description: string | null;
  category: DigitelEventCategory;
  startsAt: string;
  endsAt: string | null;
  locationName: string;
  latitude: number;
  longitude: number;
  sourceUrl: string;
  sourcePublishedAt: string | null;
  sourceUpdatedAt: string | null;
  providerMetadata: Record<string, string | null>;
}

const OFFICIAL_SOURCE_URL = 'https://www.tel-aviv.gov.il/Visitors/Events/Pages/Events.aspx';

export function mapDigitelSyncCandidate(candidate: DigitelEventCandidate, eligibleForNestupPublication = true): DigitelSyncCandidate {
  return {
    eligibleForNestupPublication,
    providerEventId: candidate.occurrenceFingerprint,
    providerTransportId: candidate.providerTransportId,
    sourceGroupId: candidate.sourceGroupId,
    occurrenceId: createOccurrenceId(candidate.provider, candidate.occurrenceFingerprint, candidate.startTime),
    occurrenceFingerprint: candidate.occurrenceFingerprint,
    title: candidate.title.trim(),
    description: candidate.description?.trim() || null,
    category: classifyDigitelCategory(`${candidate.title} ${candidate.description ?? ''} ${candidate.sourceType ?? ''}`),
    startsAt: candidate.startTime,
    endsAt: candidate.endTime,
    locationName: candidate.locationName?.trim() || 'Tel Aviv-Yafo',
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    sourceUrl: candidate.sourceUrl ?? OFFICIAL_SOURCE_URL,
    sourcePublishedAt: candidate.sourcePublishedAt,
    sourceUpdatedAt: candidate.sourceUpdatedAt,
    providerMetadata: {
      source_type: candidate.sourceType,
      source_group_id: candidate.sourceGroupId,
      icon_url: candidate.iconUrl,
    },
  };
}

/** Matches any of `words` only as a WHOLE Hebrew/Latin word — never as a
 *  substring inside a longer word. Built specifically to fix two real
 *  production misclassifications this module shipped before: GLOW (a Tel
 *  Aviv Port light exhibition) landed as 'sports' because its description
 *  says "כדורי גלקסיה" (galaxy BALLS-of) and "בריכת כדורים" (BALL-pit) —
 *  both real words, but "כדור" (ball) as a bare root, not the word this
 *  regex was meant to catch (standalone "כדור/כדורים" meaning literal
 *  sports balls). A plain substring test matched anyway, since "כדור" is a
 *  prefix of both. `\b` doesn't help here — Hebrew letters aren't `\w` in
 *  JS, so plain `\b` boundaries don't distinguish "כדור" from "כדורים".
 *  This checks that no Hebrew/Latin letter immediately precedes or follows
 *  the match instead, which does. */
function matchesWholeWord(text: string, words: readonly string[]): boolean {
  const letterClass = 'a-z\\u05D0-\\u05EA';
  const pattern = new RegExp(`(?<![${letterClass}])(?:${words.join('|')})(?![${letterClass}])`, 'u');
  return pattern.test(text);
}

/** Category classification order matters as much as the keyword lists:
 *  MOVIE/CINEMA signals are checked FIRST, before story-time, because a
 *  film's own title or synopsis routinely contains words that would
 *  otherwise false-positive elsewhere. Real production case: "צעצוע של
 *  סיפור 5" ("Toy Story 5", a Hebrew-literal translation containing
 *  "סיפור" = "story") was landing in 'story_time' because the old
 *  unordered checks let a bare "סיפור" win before the movie signal
 *  "מדובב" (dubbed) — an unambiguous film-specific word — ever got
 *  checked. A movie playing at a cinema is not a library story-time
 *  session merely because its English title contains the word "story";
 *  checking movie signals first, and treating "מדובב"/"מתורגם" as strong,
 *  low-ambiguity evidence a record IS a film screening, fixes this
 *  without adding a title-specific exception for "Toy Story" or any other
 *  one title — the same reordering benefits every other film with
 *  "story"/"סיפור" in its name. */
export function classifyDigitelCategory(text: string): DigitelEventCategory {
  const normalized = text.toLocaleLowerCase('he');

  // 1. MOVIE / CINEMA — checked first; see module doc.
  if (matchesWholeWord(normalized, ['מדובב', 'מתורגם', 'קולנוע', 'הקרנה', 'הקרנת', 'סרט']) || /movie|cinema/u.test(normalized)) {
    return 'performance';
  }
  // 2. STORY-TIME / READING ACTIVITY — "שעת סיפור" (the actual "story
  //    hour" idiom) is unambiguous on its own; a bare "סיפור" only counts
  //    once movie signals above have already had first refusal, so a real
  //    non-movie story-time series ("רביעי של סיפור" — a real DigiTel
  //    series) still matches, but a movie with "story" in its name no
  //    longer reaches this branch at all.
  if (/שעת סיפור/u.test(normalized) || matchesWholeWord(normalized, ['סיפור', 'ספרים']) || /story\s*time/u.test(normalized)) {
    return 'story_time';
  }
  // 3. WORKSHOP
  if (/סדנ|יצירה|קומיקס|פלסטלינה|בובנאות|workshop/u.test(normalized)) return 'workshop';
  // 4. PERFORMANCE — non-movie live performance (theater, circus, show).
  if (/הצג|תאטרון|תיאטרון|מופע|קרקס|performance|\bshow\b/u.test(normalized)) return 'performance';
  // 5. EXHIBITION / ATTRACTION — a distinct concept from "museum" the
  //    institution, but the closest fit in the closed, DB-enforced
  //    category enum (events_category_check) is 'museum'; introducing a
  //    new enum value is a schema change out of scope here.
  if (/תערוכ|אטרקציה|מיצג/u.test(normalized)) return 'museum';
  // 6. FESTIVAL
  if (/פסטיבל|festival/u.test(normalized)) return 'festival';
  // 7. MUSEUM
  if (/מוזיאון|ארכיאולוג|museum/u.test(normalized)) return 'museum';
  // 8. LIBRARY
  if (/ספריה|ספרייה|library/u.test(normalized)) return 'library';
  // 9. PARK
  if (/טבע|פארק|גינה|park/u.test(normalized)) return 'park';
  // 10. SPORTS — bare "כדור" (ball) requires a real word boundary, so
  //     "כדורים"/"כדורי" (ball PIT, galaxy BALLS — an installation, not a
  //     sport) no longer false-match. Named ball sports are compound words
  //     built ON "כדור" as a prefix (כדורסל="כדור"+"סל" = basketball), so
  //     the word-boundary check that correctly excludes "כדורים" would
  //     also wrongly exclude these unless listed explicitly — checked
  //     against a real production case: "חוג כדורסל בנות" (girls'
  //     basketball class) regressed to 'community' during testing until
  //     these were added. "התעמלות" (structured gymnastics/movement
  //     class) is a distinct, common, unambiguous DigiTel term for
  //     children's sport classes, also confirmed missing against real
  //     production data ("התעמלות התפתחותית" — developmental gymnastics).
  if (
    matchesWholeWord(normalized, ['יוגה', 'ספורט', 'שחייה', 'כדור', 'סייף', 'התעמלות', 'כדורסל', 'כדורגל', 'כדוריד', 'כדורעף'])
    || /\bsport/u.test(normalized)
  ) {
    return 'sports';
  }
  // 11. ANIMALS
  if (/חיות|בעלי חיים|גן חיות|animal|zoo/u.test(normalized)) return 'animals';

  return 'community';
}

export function createOccurrenceId(provider: string, providerEventId: string, startsAt: string): string {
  const identity = `${provider.trim().toLocaleLowerCase('en')}|${providerEventId.trim().toLocaleLowerCase('en')}|${new Date(startsAt).toISOString()}`;
  return `event-occ-v1-${fnv1a64(identity)}`;
}

function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const character of new TextEncoder().encode(value)) {
    hash ^= BigInt(character);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}
