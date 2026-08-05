import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import type { ArcGisFeatureResponse } from '@/integrations/digitelConnector';
import { normalizeDigitelFeatures } from '@/integrations/digitelConnector';
import { buildDigitelDryRunReport } from '@/integrations/digitelReport';

const fixture = JSON.parse(await readFile(new URL('./fixtures/digitel-page.json', import.meta.url), 'utf8')) as ArcGisFeatureResponse;
const now = new Date('2026-08-05T12:00:00.000Z');

test('dry-run report accounts for every included and excluded source record', () => {
  const normalized = normalizeDigitelFeatures(fixture.features!, { now });
  const report = buildDigitelDryRunReport(fixture.features!, normalized, now);
  assert.equal(report.totalFetched, 5);
  assert.equal(report.eventRecords + report.excludedRecords, report.totalFetched);
  assert.equal(report.excludedRecordDetails.length, report.excludedRecords);
  assert.equal(report.noticeRecordsExcluded, 1);
  assert.equal(report.invalidDateRecords, 1);
  assert.equal(report.missingTitleRecords, 1);
});

test('report includes raw missing fields, normalized completeness, duplicates, and URL analysis', () => {
  const normalized = normalizeDigitelFeatures(fixture.features!, { now });
  const report = buildDigitelDryRunReport(fixture.features!, normalized, now);
  assert.equal(report.sourceMissingFields.image_url, 2);
  assert.equal(report.sourceMissingFields.sitemapurl, 2);
  assert.equal(report.normalizedCompleteness.endTime.present, 0);
  assert.equal(report.fingerprintDuplicateGroups, 1);
  assert.equal(report.images.validHttps, 2);
  assert.equal(report.images.invalidOrNonHttps, 1);
  assert.equal(report.images.duplicateUrlGroups, 1);
  assert.equal(report.images.documentedReuseTerms, false);
});
