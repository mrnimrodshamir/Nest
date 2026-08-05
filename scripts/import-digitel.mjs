import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  fetchAllDigitelFeatures,
  fetchAndValidateDigitelSource,
  normalizeDigitelFeatures,
} from '../src/integrations/digitelConnector.ts';
import { buildDigitelDryRunReport } from '../src/integrations/digitelReport.ts';
import { buildDigitelQualityReport, buildDigitelStagingBundle } from '../src/integrations/digitelStaging.ts';

const args = process.argv.slice(2);
if (args.includes('--apply') || args.includes('--publish')) throw new Error('DigiTel Sprint 5 is dry-run only; apply and publish are not supported.');
const outputDirArg = valueAfter('--output-dir');
if (!outputDirArg) throw new Error('Usage: npm run digitel:dry-run -- --output-dir <path> [--history-days 30] [--page-size 500]');
const outputDir = resolve(outputDirArg);
const historyDays = boundedNumber(valueAfter('--history-days'), 30, 0, 365);
const pageSize = boundedNumber(valueAfter('--page-size'), 500, 1, 2_000);
const timeoutMs = boundedNumber(valueAfter('--timeout-ms'), 10_000, 100, 60_000);
const maxAttempts = boundedNumber(valueAfter('--max-attempts'), 3, 1, 5);

const source = await fetchAndValidateDigitelSource({ timeoutMs, maxAttempts });
if (!source.validation.valid) throw new Error(`DigiTel source validation failed: ${source.validation.errors.join(', ')}`);
const fetched = await fetchAllDigitelFeatures({ pageSize, timeoutMs, maxAttempts });
const generatedAt = new Date();
const normalized = normalizeDigitelFeatures(fetched.features, { historyDays, now: generatedAt });
const staging = buildDigitelStagingBundle({
  result: normalized,
  sourceValidation: source.validation,
  generatedAt,
  pagesFetched: fetched.pages,
  requestAttempts: source.requestAttempts + fetched.requestAttempts,
  retryCount: source.retryCount + fetched.retryCount,
});
const quality = buildDigitelQualityReport(staging.deduplicated.uniqueCandidates, generatedAt);
const sourceReport = {
  endpoint: fetched.requestUrls[0]?.split('?')[0] ?? null,
  layerMetadataEndpoint: 'https://gisn.tel-aviv.gov.il/arcgis/rest/services/IView2/MapServer/410?f=json',
  sourceValidation: source.validation,
  pagesFetched: fetched.pages,
  pageSize,
  historyDays,
  timeoutMs,
  maxAttempts,
  requestAttempts: source.requestAttempts + fetched.requestAttempts,
  retryCount: source.retryCount + fetched.retryCount,
  queryParameters: Object.fromEntries(new URL(fetched.requestUrls[0]).searchParams.entries()),
  ...buildDigitelDryRunReport(fetched.features, normalized, generatedAt),
};
const duplicateReport = {
  generatedAt: generatedAt.toISOString(),
  candidateCount: normalized.candidates.length,
  uniqueCandidateCount: staging.deduplicated.uniqueCandidates.length,
  duplicateGroupCount: staging.deduplicated.duplicateGroups.length,
  duplicateRecordCount: staging.deduplicated.duplicateRecordCount,
  groups: staging.deduplicated.duplicateGroups,
};

await mkdir(outputDir, { recursive: true });
await Promise.all([
  save('digitel-staging.json', staging.bundle),
  save('digitel-normalized.json', staging.deduplicated.uniqueCandidates),
  save('digitel-staging-report.json', staging.report),
  save('digitel-duplicate-report.json', duplicateReport),
  save('digitel-quality-report.json', quality),
  save('digitel-source-report.json', sourceReport),
]);

process.stdout.write(`${JSON.stringify({
  dryRun: true,
  publishedRecords: 0,
  outputDir,
  sourceValid: source.validation.valid,
  fetched: fetched.features.length,
  normalized: normalized.candidates.length,
  unique: staging.deduplicated.uniqueCandidates.length,
  duplicates: staging.deduplicated.duplicateRecordCount,
  excluded: normalized.excluded.length,
  averageQualityScore: quality.averageScore,
}, null, 2)}\n`);

function valueAfter(flag) {
  const index = args.indexOf(flag);
  return index >= 0 ? args[index + 1] : null;
}

function boundedNumber(value, fallback, minimum, maximum) {
  const parsed = value == null ? fallback : Number(value);
  if (!Number.isFinite(parsed) || parsed < minimum || parsed > maximum) throw new Error(`Invalid numeric option: ${value}`);
  return Math.floor(parsed);
}

async function save(name, value) {
  await writeFile(resolve(outputDir, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
}
