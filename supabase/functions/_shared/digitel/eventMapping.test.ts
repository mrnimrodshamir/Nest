import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyDigitelCategory } from './eventMapping.ts';

// ===========================================================================
// THE TWO REQUESTED PRODUCTION FIXES — real titles/descriptions, not
// synthetic examples.
// ===========================================================================

test('GLOW (Tel Aviv Port): a light exhibition mentioning "כדורי גלקסיה" and "בריכת כדורים" is NOT sports — "כדור" as a substring inside "כדורים"/"כדורי" must not match', () => {
  const text = 'אורות, לייזרים וחדר מלא בלונים: תערוכת GLOW מגיעה לנמל תל אביב '
    + 'תערוכת האור הבינלאומית GLOW. בין היתר תמצאו משחקי לייזר, מתחם חלל עם מיצגי כדורי גלקסיה, '
    + 'חדר מלא בבלוני ענק, בריכת כדורים צבעונית, מתחם איפור זוהר.';
  assert.equal(classifyDigitelCategory(text), 'museum');
});

test('Toy Story 5 (Cinematheque): a dubbed film whose Hebrew title contains "סיפור" (story) is a movie, not story_time', () => {
  const text = 'צעצוע של סיפור 5 - מדובב | המרכז למשפחה צעצוע של סיפור 5 | Toy Story 5 הצעצועים חוזרים ב״צעצוע של סיפור 5״ מבית דיסני פיקסאר.';
  assert.equal(classifyDigitelCategory(text), 'performance');
});

test('DigiTel\'s own "שבת סרט - צעצוע של סיפור 5" listing has the identical real bug and is fixed the same way', () => {
  assert.equal(classifyDigitelCategory('שבת סרט - צעצוע של סיפור 5'), 'performance');
});

// ===========================================================================
// REGRESSIONS CAUGHT DURING THE PRODUCTION BEFORE/AFTER DIFF — fixed
// before shipping, covered here so they cannot silently return.
// ===========================================================================

test('"כדורסל" (basketball) still matches sports — a compound word built ON "כדור", not the bare word', () => {
  assert.equal(classifyDigitelCategory('הפנינג חשיפה כדורסל בנות — חוג כדורסל בנות בשיתוף מכבי ת"א'), 'sports');
});

test('"כדורגל", "כדוריד", "כדורעף" — the other named ball sports — all still match sports', () => {
  assert.equal(classifyDigitelCategory('חוג כדורגל לילדים'), 'sports');
  assert.equal(classifyDigitelCategory('אימון כדוריד לנוער'), 'sports');
  assert.equal(classifyDigitelCategory('משחק כדורעף חופי'), 'sports');
});

test('"התעמלות" (structured gymnastics/movement class) is sports — a real production case that regressed to community during testing', () => {
  assert.equal(classifyDigitelCategory('התעמלות התפתחותית שנה וחצי-שנתיים וחצי — מפגש של חוויה ספורטיבית הורה ובייבי'), 'sports');
});

test('a genuine standalone "כדור"/"כדורים" (sports ball / balls) still matches sports when not part of an installation-language compound', () => {
  assert.equal(classifyDigitelCategory('משחקי כדור בחצר בית הספר'), 'sports');
});

// ===========================================================================
// PRIORITY ORDER — movie signals checked before story-time, generically
// ===========================================================================

test('any film described as "מדובב" (dubbed) or "מתורגם" (subtitled) is a movie, regardless of what else the title contains', () => {
  assert.equal(classifyDigitelCategory('הרפתקת סיפורים מוזרה - מדובב'), 'performance');
  assert.equal(classifyDigitelCategory('אגדת הספרים האבודים - מתורגם'), 'performance');
});

test('a real non-movie story-time series ("שעת סיפור" / "רביעי של סיפור") still correctly classifies story_time', () => {
  assert.equal(classifyDigitelCategory('שעת סיפור בספריית בית אריאלה'), 'story_time');
  assert.equal(classifyDigitelCategory('רביעי של סיפור - מי ראה את פלוטי'), 'story_time');
});

test('"קולנוע" (cinema) anywhere in the text routes to performance, not community', () => {
  assert.equal(classifyDigitelCategory('הכל נשאר במשפחה - קולנוע זוהר בחשיכה'), 'performance');
  assert.equal(classifyDigitelCategory('קולנוע קיץ בבגין - סופר צ\'ארלי'), 'performance');
});

// ===========================================================================
// EXHIBITION / ATTRACTION — new bucket, maps to the closed 'museum' enum
// ===========================================================================

test('an explicit "תערוכה" (exhibition) routes to museum', () => {
  assert.equal(classifyDigitelCategory('ערב סיכום תערוכת קטלוגי אמן'), 'museum');
});

// ===========================================================================
// STILL-WORKING BASELINE — every pre-existing category remains reachable
// ===========================================================================

test('workshop, festival, museum, library, park, animals, and community all remain reachable', () => {
  assert.equal(classifyDigitelCategory('סדנת יצירה בפלסטלינה לילדים'), 'workshop');
  assert.equal(classifyDigitelCategory('פסטיבל הקיץ בפארק הירקון'), 'festival');
  assert.equal(classifyDigitelCategory('מוזיאון תל אביב לאמנות - סיור למשפחות'), 'museum');
  assert.equal(classifyDigitelCategory('ערב קריאה בספרייה השכונתית'), 'library');
  assert.equal(classifyDigitelCategory('טיול טבע בגן הירקון'), 'park');
  assert.equal(classifyDigitelCategory('סיור בגן החיות התנ"כי'), 'animals');
  assert.equal(classifyDigitelCategory('מסיבת רחוב שכונתית'), 'community');
});

test('an empty/unmatched string falls back to community, never throws', () => {
  assert.equal(classifyDigitelCategory(''), 'community');
  assert.equal(classifyDigitelCategory('   '), 'community');
});
