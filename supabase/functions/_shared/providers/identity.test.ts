import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyCrossProviderMatch, normalizedTitleSimilarity } from './identity.ts';
import type { DedupeComparable } from './identity.ts';

function digitel(overrides: Partial<DedupeComparable> = {}): DedupeComparable {
  return {
    provider: 'tel_aviv_digitel',
    title: 'שעת סיפור בספריית בית אריאלה',
    startsAt: '2026-08-20T10:00:00+03:00',
    locationName: 'בית אריאלה',
    latitude: 32.076704, longitude: 34.786295,
    ...overrides,
  };
}

function ariela(overrides: Partial<DedupeComparable> = {}): DedupeComparable {
  return {
    provider: 'beit_ariela_libraries',
    title: 'שעת סיפור בספריית בית אריאלה',
    startsAt: '2026-08-20T10:00:00+03:00',
    locationName: 'בית אריאלה',
    latitude: 32.076704, longitude: 34.786295,
    ...overrides,
  };
}

// ===========================================================================
// EXACT — same title, same time (±5min), same venue
// ===========================================================================

test('identical title, time and venue across two providers is EXACT', () => {
  const result = classifyCrossProviderMatch(digitel(), ariela());
  assert.equal(result.classification, 'EXACT');
});

test('a 3-minute clock difference between two providers is still EXACT', () => {
  const result = classifyCrossProviderMatch(digitel(), ariela({ startsAt: '2026-08-20T10:03:00+03:00' }));
  assert.equal(result.classification, 'EXACT');
});

test('DigiTel and Beit Ariela reporting the SAME occurrence classify EXACT — the real cross-provider duplicate case', () => {
  // The scenario the design brief names explicitly: the same library story
  // time appears on the municipal feed and on the library's own site.
  const result = classifyCrossProviderMatch(
    digitel({ title: 'שעת סיפור לפעוטות — בית אריאלה', provider: 'tel_aviv_digitel' }),
    ariela({ title: 'שעת סיפור לפעוטות — בית אריאלה', provider: 'beit_ariela_libraries' }),
  );
  assert.equal(result.classification, 'EXACT');
});

// ===========================================================================
// PROBABLE — strong but not certain
// ===========================================================================

test('same time and venue, moderately similar title, is PROBABLE not EXACT', () => {
  const result = classifyCrossProviderMatch(
    digitel({ title: 'שעת סיפור לפעוטות בבית אריאלה עם גלי' }),
    ariela({ title: 'שעת סיפור לפעוטות בבית אריאלה עם דנה' }),
  );
  assert.equal(result.titleSimilarity >= 0.55 && result.titleSimilarity < 0.85, true, `expected a moderate similarity, got ${result.titleSimilarity}`);
  assert.equal(result.classification, 'PROBABLE');
});

test('identical title but 20 minutes apart (rounding between two sources) is PROBABLE', () => {
  const result = classifyCrossProviderMatch(digitel(), ariela({ startsAt: '2026-08-20T10:20:00+03:00' }));
  assert.equal(result.classification, 'PROBABLE');
});

// ===========================================================================
// AMBIGUOUS — some signal, not enough to trust
// ===========================================================================

test('same day, same venue, unrelated titles, different times is AMBIGUOUS', () => {
  const result = classifyCrossProviderMatch(
    digitel({ title: 'סדנת יצירה' }),
    ariela({ title: 'הצגת בובות', startsAt: '2026-08-20T16:00:00+03:00' }),
  );
  assert.equal(result.classification, 'AMBIGUOUS');
});

test('same title, same day, but two DIFFERENT venues is AMBIGUOUS, not EXACT', () => {
  const result = classifyCrossProviderMatch(
    digitel({ locationName: 'בית אריאלה', latitude: 32.0767, longitude: 34.7863 }),
    ariela({ locationName: 'ספריית שרמן', latitude: 32.050212, longitude: 34.776313, startsAt: '2026-08-20T10:10:00+03:00' }),
  );
  assert.notEqual(result.classification, 'EXACT');
});

// ===========================================================================
// DISTINCT — no meaningful overlap
// ===========================================================================

test('different title, different day, different venue is DISTINCT', () => {
  const result = classifyCrossProviderMatch(
    digitel({
      title: 'סדנת התעמלות להורים ותינוקות', startsAt: '2026-08-20T10:00:00+03:00',
      locationName: 'ספריית שרמן', latitude: 32.050212, longitude: 34.776313,
    }),
    ariela({
      title: 'מוזיאון תל אביב לאמנות — סיור למשפחות', startsAt: '2026-09-05T18:00:00+03:00',
      locationName: 'מוזיאון תל אביב לאמנות', latitude: 32.0784, longitude: 34.7864,
    }),
  );
  assert.equal(result.classification, 'DISTINCT');
});

// ===========================================================================
// THE REAL 3-HOUR CASE FROM THE LIVE DRY RUN
//
// "ההצגה ״אבא של עמליה נוסע לאוסטרליה״" appeared on both DigiTel and Beit
// Ariela: identical title, identical venue (Beit Ariela's own building), but
// starsAt three hours apart (11:00 vs 14:00 Israel time). Approved rule:
// same/similar title and venue but a MATERIALLY different start time stays
// two separate occurrences unless a stronger provider identity proves they
// are the same one. Neither provider currently exposes such an identity, so
// this — and every case shaped like it — must classify AMBIGUOUS, never
// EXACT or PROBABLE, and nothing may auto-link it.
// ===========================================================================

test('the real 3-hour same-title same-venue case from the live dry run classifies AMBIGUOUS, never EXACT or PROBABLE', () => {
  const result = classifyCrossProviderMatch(
    digitel({ title: 'ההצגה ״אבא של עמליה נוסע לאוסטרליה״', startsAt: '2026-08-20T14:00:00+03:00' }),
    ariela({ title: 'ההצגה ״אבא של עמליה נוסע לאוסטרליה״', startsAt: '2026-08-20T11:00:00+03:00' }),
  );
  assert.equal(result.classification, 'AMBIGUOUS');
  assert.equal(result.timeDeltaMinutes, 180);
});

test('identical title and venue is NEVER enough on its own — EXACT always requires close time too', () => {
  for (const hoursApart of [1, 2, 3, 6, 12]) {
    const later = new Date(Date.parse('2026-08-20T10:00:00+03:00') + hoursApart * 3_600_000).toISOString();
    const result = classifyCrossProviderMatch(digitel(), ariela({ startsAt: later }));
    assert.notEqual(result.classification, 'EXACT', `${hoursApart}h apart must not be EXACT`);
  }
});

// ===========================================================================
// PROXIMITY ALONE IS NEVER SUFFICIENT — the real Phase C production cases
//
// A large venue/complex (a port, a park, a cinematheque, a mall, a museum,
// a library system) legitimately hosts many unrelated events. Geographic
// proximity by itself must never be enough for EXACT, PROBABLE, or
// AMBIGUOUS — it must be corroborated by at least one other signal (title
// similarity or close timing).
// ===========================================================================

test('GLOW (Tel Aviv Port) vs a real nearby-but-unrelated DigiTel port event is DISTINCT — proximity alone (178m, 4.8 days apart, unrelated titles) is not enough', () => {
  const result = classifyCrossProviderMatch(
    { provider: 'tel_aviv_port', title: 'אורות, לייזרים וחדר מלא בלונים: תערוכת GLOW מגיעה לנמל תל אביב', startsAt: '2026-08-13T21:00:00.000Z', locationName: 'האנגר 11, נמל תל אביב', latitude: 32.099096, longitude: 34.775714 },
    { provider: 'tel_aviv_digitel', title: 'שרים עם שירי - בנמל!', startsAt: '2026-08-18T16:30:00Z', locationName: 'מתחם ליפקין שחק- שטח הנמל 15', latitude: 32.099021748868, longitude: 34.7738270867459 },
  );
  assert.equal(result.classification, 'DISTINCT');
  assert.ok(result.distanceMeters! < 300, 'the two really are close in space — that alone is exactly what must not decide this');
});

test('Cinematheque Toy Story 5 vs DigiTel\'s own Toy Story 5 at the same address is still AMBIGUOUS — three corroborating signals (weak title overlap, same-day time, same venue), not just proximity', () => {
  const result = classifyCrossProviderMatch(
    { provider: 'tel_aviv_cinematheque', title: 'צעצוע של סיפור 5 - מדובב | המרכז למשפחה', startsAt: '2026-08-22T11:00:00+03:00', locationName: 'סינמטק תל אביב', latitude: 32.070663, longitude: 34.78335 },
    { provider: 'tel_aviv_digitel', title: 'שבת סרט - צעצוע של סיפור 5', startsAt: '2026-08-22T09:00:00Z', locationName: 'הארבעה 5', latitude: 32.0706651539424, longitude: 34.7833500085449 },
  );
  assert.equal(result.classification, 'AMBIGUOUS');
  assert.notEqual(result.classification, 'EXACT');
  assert.ok(result.titleSimilarity > 0, 'real shared tokens ("צעצוע", "של", "סיפור", "5") corroborate this, not proximity alone');
});

test('a venue match with weak title AND same-day time (two signals) is AMBIGUOUS even without exact proximity', () => {
  const result = classifyCrossProviderMatch(
    { provider: 'a', title: 'סדנת יצירה למשפחות', startsAt: '2026-08-20T10:00:00+03:00', locationName: 'נמל תל אביב', latitude: 32.099096, longitude: 34.775714 },
    { provider: 'b', title: 'סדנה יצירתית לילדים', startsAt: '2026-08-20T15:00:00+03:00', locationName: 'נמל תל אביב', latitude: 32.099096, longitude: 34.775714 },
  );
  assert.equal(result.classification, 'AMBIGUOUS');
});

test('proximity plus nothing else — same venue, unrelated title, days apart — is DISTINCT', () => {
  const result = classifyCrossProviderMatch(
    { provider: 'a', title: 'הרצאה על כלכלה', startsAt: '2026-08-13T21:00:00Z', locationName: 'נמל תל אביב', latitude: 32.099096, longitude: 34.775714 },
    { provider: 'b', title: 'שיעור יוגה בוקר', startsAt: '2026-08-20T06:00:00Z', locationName: 'נמל תל אביב', latitude: 32.099096, longitude: 34.775714 },
  );
  assert.equal(result.classification, 'DISTINCT');
});

// ===========================================================================
// NEVER AUTO-MERGE ANYTHING BUT EXACT
// ===========================================================================

test('PROBABLE and AMBIGUOUS are never returned as EXACT — the only classification permitted to auto-link', () => {
  const probable = classifyCrossProviderMatch(digitel(), ariela({ startsAt: '2026-08-20T10:20:00+03:00' }));
  const ambiguous = classifyCrossProviderMatch(
    digitel({ title: 'סדנת יצירה' }), ariela({ title: 'הצגת בובות', startsAt: '2026-08-20T20:00:00+03:00' }),
  );
  assert.notEqual(probable.classification, 'EXACT');
  assert.notEqual(ambiguous.classification, 'EXACT');
});

// ===========================================================================
// TITLE SIMILARITY — the explainable building block
// ===========================================================================

test('identical normalized titles score 1.0 similarity', () => {
  assert.equal(normalizedTitleSimilarity('שעת סיפור', 'שעת סיפור'), 1);
});

test('completely disjoint titles score 0', () => {
  assert.equal(normalizedTitleSimilarity('שעת סיפור', 'הרצאה על כלכלה'), 0);
});

test('an empty title never divides by zero and never false-matches', () => {
  assert.equal(normalizedTitleSimilarity('', 'שעת סיפור'), 0);
  assert.equal(normalizedTitleSimilarity('', ''), 0);
});
