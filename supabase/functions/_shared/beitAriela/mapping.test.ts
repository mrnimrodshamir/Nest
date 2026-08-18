import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mapBeitArielaRecord, BEIT_ARIELA_PROVIDER_KEY } from './mapping.ts';
import type { BeitArielaRawRecord } from './connector.ts';

function raw(overrides: Partial<BeitArielaRawRecord> = {}): BeitArielaRawRecord {
  return {
    slug: 'mr-tzprga',
    title: '״מר צפרדע והנחל המתוק״',
    subhead: 'שעת סיפור עם לילך שחר',
    place: 'ספריית רמת ישראל — ביצרון',
    address: 'רח׳ דם המכבים 22',
    audienceText: 'לגילי 6-3',
    priceText: 'מחיר: 20 ₪',
    registrationUrl: 'https://www.coing.co/TLV_RamatIsraelbitzaron/272492',
    description: 'מר צפרדע רוצה לצאת מהנחל המתוק.',
    imageUrl: 'https://ariela.today/media/pages/events/mr-tzprga/photo.png',
    imageCredit: 'תמונה: Canva/סיון חברי',
    startsAt: '2026-08-18T11:00:00+03:00',
    endsAt: '2026-08-18T11:45:00+03:00',
    sourceUrl: 'https://ariela.today/events/mr-tzprga',
    ...overrides,
  };
}

test('a fully-resolvable record (a branch present in the coordinates table) maps to a candidate', () => {
  const result = mapBeitArielaRecord(raw({ place: 'בית אריאלה' }));
  assert.equal(result.excludedReason, null);
  assert.ok(result.candidate);
  assert.equal(result.candidate!.latitude, 32.076704);
  assert.equal(result.candidate!.longitude, 34.786295);
});

test('a branch NOT in the verified coordinates table is excluded, never given a guessed pin', () => {
  const result = mapBeitArielaRecord(raw({ place: 'ספרייה שלא קיימת בטבלה' }));
  assert.equal(result.candidate, null);
  assert.equal(result.excludedReason, 'coordinates_unresolved');
});

test('a missing title is excluded rather than producing an empty-titled event', () => {
  const result = mapBeitArielaRecord(raw({ title: '', place: 'בית אריאלה' }));
  assert.equal(result.excludedReason, 'missing_title');
});

// ===========================================================================
// IMAGE RIGHTS — never surfaced as the displayed image without clearance
// ===========================================================================

test('the source image is NEVER copied into the candidate as a displayable image field', () => {
  const result = mapBeitArielaRecord(raw({ place: 'בית אריאלה' }));
  // ProviderCandidate has no generic "imageUrl" field precisely so this
  // cannot happen by omission; the source image only exists inside
  // providerMetadata, clearly namespaced as provenance, never rendered.
  assert.equal('imageUrl' in result.candidate!, false);
  assert.equal(result.candidate!.providerMetadata.source_image_url, raw().imageUrl);
});

test('image credit is retained in metadata for provenance even though the image itself is not used', () => {
  const result = mapBeitArielaRecord(raw({ place: 'בית אריאלה' }));
  assert.equal(result.candidate!.providerMetadata.source_image_credit, 'תמונה: Canva/סיון חברי');
});

// ===========================================================================
// UNKNOWN FIELDS PROPAGATE AS UNKNOWN, NOT GUESSED
// ===========================================================================

test('unknown age (unparseable audience text) propagates as null, not a fabricated range', () => {
  const result = mapBeitArielaRecord(raw({ place: 'בית אריאלה', audienceText: 'מתאים לכולם' }));
  assert.equal(result.candidate!.ageMinMonths, null);
  assert.equal(result.candidate!.ageMaxMonths, null);
});

test('unknown price (no price block on the page) propagates as null', () => {
  const result = mapBeitArielaRecord(raw({ place: 'בית אריאלה', priceText: null }));
  assert.equal(result.candidate!.priceNote, null);
});

test('air_conditioned is null for a real record — Beit Ariela copy never states it either way', () => {
  const result = mapBeitArielaRecord(raw({ place: 'בית אריאלה' }));
  assert.equal(result.candidate!.airConditioned, null);
});

test('indoorOutdoor is "indoor" for every Beit Ariela record — every branch is a library building, which is a location fact, not an amenity claim like AC', () => {
  const result = mapBeitArielaRecord(raw({ place: 'בית אריאלה' }));
  assert.equal(result.candidate!.indoorOutdoor, 'indoor');
});

test('a real parsed price and age both come through correctly on a fully-populated record', () => {
  const result = mapBeitArielaRecord(raw({ place: 'בית אריאלה' }));
  assert.equal(result.candidate!.priceNote, '20 ₪');
  assert.deepEqual(
    { min: result.candidate!.ageMinMonths, max: result.candidate!.ageMaxMonths },
    { min: 36, max: 72 },
  );
});

test('sourceType is always municipal for this provider', () => {
  const result = mapBeitArielaRecord(raw({ place: 'בית אריאלה' }));
  assert.equal(result.candidate!.sourceType, 'municipal');
});

void BEIT_ARIELA_PROVIDER_KEY;
