import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dryRunPlaceImport, parsePlacesCsv, type ExistingPlaceCandidate, type PlaceImportRow } from '@/internal/placesImport';

const outputUrl = new URL('../../docs/places/output/', import.meta.url);
const passCsv = readFileSync(new URL('tel_aviv_places_sprint3_pass.csv', outputUrl), 'utf8');
const passJson = JSON.parse(readFileSync(new URL('tel_aviv_places_sprint3_pass.json', outputUrl), 'utf8')) as PlaceImportRow[];
const reviewCsv = parsePlacesCsv(readFileSync(new URL('tel_aviv_places_sprint3_review.csv', outputUrl), 'utf8'));
const failLines = readFileSync(new URL('tel_aviv_places_sprint3_fail.csv', outputUrl), 'utf8').trim().split(/\r?\n/);
const previous = JSON.parse(readFileSync(new URL('tel_aviv_places_normalized.json', outputUrl), 'utf8')) as Array<Record<string, unknown>>;

const existing: ExistingPlaceCandidate[] = previous.map((row, index) => ({
  id: `existing-${index + 1}`,
  name: String(row.name),
  slug: row.slug == null ? null : String(row.slug),
  latitude: Number(row.latitude),
  longitude: Number(row.longitude),
  sourceName: row.source_name == null ? null : String(row.source_name),
  externalId: row.external_id == null ? null : String(row.external_id),
  provider: row.provider == null ? null : String(row.provider),
  providerPlaceId: row.provider_place_id == null ? null : String(row.provider_place_id),
}));

test('Sprint 3 resolves every queued record without forcing review rows into PASS', () => {
  assert.equal(passJson.length, 30);
  assert.equal(reviewCsv.length, 6);
  assert.equal(failLines.length, 1);
  assert.equal(passJson.length + reviewCsv.length, 36);
});

test('Sprint 3 CSV and JSON contain the same ordered records', () => {
  const csvRows = parsePlacesCsv(passCsv);
  assert.deepEqual(csvRows.map((row) => row.slug), passJson.map((row) => row.slug));
  assert.deepEqual(csvRows.map((row) => row.provider_place_id || null), passJson.map((row) => row.provider_place_id ?? null));
});

test('Sprint 3 PASS records produce inserts with no errors or duplicate candidates', () => {
  const result = dryRunPlaceImport(passJson, existing);
  assert.deepEqual(result.summary, { total: 30, passed: 30, failed: 0, review: 0, inserts: 30, updates: 0, duplicates: 0 });
  assert.equal(result.manualReview.length, 0);
});

test('Sprint 3 preserves unknown family attributes as null', () => {
  for (const row of passJson) {
    assert.equal(row.min_age_months, null);
    assert.equal(row.max_age_months, null);
    assert.equal(row.stroller_friendly, null);
    assert.equal(row.changing_table, null);
    assert.equal(row.toilets, null);
    assert.equal(row.shade, null);
    assert.equal(row.water_fountain, null);
    assert.notEqual(row.category, 'family_cafe');
    assert.equal(row.verification_status, 'verified');
  }
});
