import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapTelAvivPortRecord, isFamilyTagged } from './mapping.ts';
import type { TelAvivPortRawRecord } from './connector.ts';

function raw(overrides: Partial<TelAvivPortRawRecord> = {}): TelAvivPortRawRecord {
  return {
    slug: 'glow',
    title: 'אורות, לייזרים וחדר מלא בלונים: תערוכת GLOW מגיעה לנמל תל אביב',
    termIds: ['17', '47', '55', '69'],
    description: 'תערוכה ממוזגת שמתאימה גם לילדים וגם למבוגרים. 📍 האנגר 11, נמל תל אביב',
    priceText: '129 ₪ במכירה מוקדמת | 139 ₪ מחיר מלא',
    registrationUrl: 'https://www.to-mix.co.il/glow-exhibition/',
    venueLine: 'האנגר 11, נמל תל אביב',
    startsAt: '2026-08-13T21:00:00.000Z',
    endsAt: '2026-08-30T21:00:00.000Z',
    sourceUrl: 'https://www.namal.co.il/events/glow/',
    ...overrides,
  };
}

test('isFamilyTagged: term-id-47 (Kids) or term-id-69 (Family) is required, no other tag counts', () => {
  assert.equal(isFamilyTagged(['47']), true);
  assert.equal(isFamilyTagged(['69']), true);
  assert.equal(isFamilyTagged(['17', '52', '55']), false);
  assert.equal(isFamilyTagged([]), false);
});

test('a family-tagged record maps to a candidate with the canonical Port venue', () => {
  const result = mapTelAvivPortRecord(raw());
  assert.equal(result.excludedReason, null);
  assert.ok(result.candidate);
  assert.equal(result.candidate!.latitude, 32.099096);
  assert.equal(result.candidate!.longitude, 34.775714);
  assert.equal(result.candidate!.sourceType, 'external_organizer');
});

test('a record without term-id 47 or 69 is excluded — the taxonomy is authoritative, not title text', () => {
  const result = mapTelAvivPortRecord(raw({ termIds: ['17', '52', '55'], title: 'סדנה לילדים ומשפחות' }));
  assert.equal(result.candidate, null);
  assert.equal(result.excludedReason, 'not_family_tagged');
});

test('a missing title is excluded', () => {
  const result = mapTelAvivPortRecord(raw({ title: '' }));
  assert.equal(result.excludedReason, 'missing_title');
});

// ===========================================================================
// AIR CONDITIONING — only from explicit source text
// ===========================================================================

test('explicit "ממוזג" in the description sets air_conditioned true — a real, source-stated fact', () => {
  const result = mapTelAvivPortRecord(raw());
  assert.equal(result.candidate!.airConditioned, true);
});

test('a description that never mentions air conditioning leaves it null, never guessed from venue type', () => {
  const result = mapTelAvivPortRecord(raw({ description: 'פסטיבל קיץ חדש לכל המשפחה בכניסה חופשית' }));
  assert.equal(result.candidate!.airConditioned, null);
});

// ===========================================================================
// INDOOR/OUTDOOR — only from an explicit named indoor structure
// ===========================================================================

test('"האנגר" (hangar) in the venue line is treated as a named indoor structure', () => {
  const result = mapTelAvivPortRecord(raw());
  assert.equal(result.candidate!.indoorOutdoor, 'indoor');
});

test('a venue with no named indoor structure leaves indoor/outdoor null, never guessed', () => {
  const result = mapTelAvivPortRecord(raw({ venueLine: null, description: 'פסטיבל על רחבת הנמל' }));
  assert.equal(result.candidate!.indoorOutdoor, null);
});

// ===========================================================================
// PRICE — the source's own words, never a guessed number
// ===========================================================================

test('a real price line is retained as text, not parsed into a number', () => {
  const result = mapTelAvivPortRecord(raw());
  assert.equal(result.candidate!.priceNote, '129 ₪ במכירה מוקדמת | 139 ₪ מחיר מלא');
});

test('a missing price stays null', () => {
  const result = mapTelAvivPortRecord(raw({ priceText: null }));
  assert.equal(result.candidate!.priceNote, null);
});

// ===========================================================================
// IMAGE RIGHTS — no image field exists on the candidate at all
// ===========================================================================

test('ProviderCandidate has no generic image field this connector could accidentally populate', () => {
  const result = mapTelAvivPortRecord(raw());
  assert.equal('imageUrl' in result.candidate!, false);
});
