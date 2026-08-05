import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import type { ArcGisFeatureResponse } from '@/integrations/digitelConnector';
import { normalizeDigitelFeatures, validateDigitelSourceMetadata } from '@/integrations/digitelConnector';
import {
  buildDigitelQualityReport,
  buildDigitelStagingBundle,
  deduplicateDigitelCandidates,
} from '@/integrations/digitelStaging';

const fixture = JSON.parse(await readFile(new URL('./fixtures/digitel-page.json', import.meta.url), 'utf8')) as ArcGisFeatureResponse;
const generatedAt = new Date('2026-08-05T12:00:00.000Z');
const sourceValidation = validateDigitelSourceMetadata({
  id: 410,
  name: 'אירועים דיגיתל',
  geometryType: 'esriGeometryPoint',
  maxRecordCount: 2_000,
  capabilities: 'Query',
  fields: [
    'OBJECTID', 'title', 'startdate', 'location', 'type', 'NbrId', 'description', 'summary',
    'image_url', 'icon_url', 'sitemapurl', 'modified', 'publishdate', 'lat', 'lon',
  ].map((name) => ({ name })),
});

test('deduplication selects a stable canonical OBJECTID and preserves review rows', () => {
  const normalized = normalizeDigitelFeatures(fixture.features!, { now: generatedAt });
  const deduplicated = deduplicateDigitelCandidates([...normalized.candidates].reverse());
  assert.equal(deduplicated.uniqueCandidates.length, 1);
  assert.equal(deduplicated.duplicateRecordCount, 1);
  assert.equal(deduplicated.duplicateGroups[0].canonicalProviderTransportId, '101');
  assert.deepEqual(deduplicated.duplicateGroups[0].duplicateProviderTransportIds, ['105']);
});

test('staging is explicitly dry-run and accounts for ready, duplicate, and excluded rows', () => {
  const normalized = normalizeDigitelFeatures(fixture.features!, { now: generatedAt });
  const staging = buildDigitelStagingBundle({
    result: normalized,
    sourceValidation,
    generatedAt,
    pagesFetched: 2,
    requestAttempts: 3,
    retryCount: 1,
  });
  assert.equal(staging.bundle.dryRun, true);
  assert.equal(staging.bundle.publishedRecords, 0);
  assert.equal(staging.bundle.stagedRecords.filter((row) => row.status === 'ready').length, 1);
  assert.equal(staging.bundle.stagedRecords.filter((row) => row.status === 'duplicate_review').length, 1);
  assert.equal(staging.bundle.excludedRecords.length, 3);
  assert.equal(staging.report.totalFetched, fixture.features!.length);
  assert.equal(staging.report.uniqueCandidates, 1);
  assert.equal(staging.report.duplicateGroups, 1);
  assert.equal(staging.report.retryCount, 1);
});

test('quality report scores missing source fields without inventing data', () => {
  const candidates = normalizeDigitelFeatures(fixture.features!, { now: generatedAt }).candidates;
  const unique = deduplicateDigitelCandidates(candidates).uniqueCandidates;
  const incomplete = { ...unique[0], imageUrl: null, sourceUpdatedAt: null };
  const report = buildDigitelQualityReport([incomplete], generatedAt);
  assert.equal(report.candidateCount, 1);
  assert.equal(report.issues.missing_description, 0);
  assert.equal(report.issues.missing_image_url, 1);
  assert.equal(report.issues.missing_source_updated_at, 1);
  assert.equal(report.candidates[0].score, 60);
  assert.equal(report.candidates[0].band, 'medium');
});

test('importer is a read-only dry run with no publishing or Supabase client', async () => {
  const importer = await readFile(new URL('../../scripts/import-digitel.mjs', import.meta.url), 'utf8');
  assert.match(importer, /publishedRecords:\s*0/);
  assert.match(importer, /--apply/);
  assert.match(importer, /--publish/);
  assert.doesNotMatch(importer, /from ['"]@supabase|\.from\(|\.insert\(|\.upsert\(/);
});
