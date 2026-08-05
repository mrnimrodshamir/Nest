import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { curateDigitelActivation } from '../src/integrations/digitelActivation.ts';
import { buildActivationImportSql } from '../src/integrations/eventActivationSql.ts';

const args = process.argv.slice(2);
if (args.includes('--apply') || args.includes('--publish')) throw new Error('This command prepares a dry run only and performs zero Supabase writes.');
const input = valueAfter('--input'); const outputDir = valueAfter('--output-dir');
const batchId = valueAfter('--batch-id') ?? 'digitel-sprint9-20260805-v1';
if (!input || !outputDir) throw new Error('Usage: node scripts/prepare-digitel-activation.mjs --input <digitel-normalized.json> --output-dir <dir> [--batch-id id]');
const candidates = JSON.parse(await readFile(resolve(input), 'utf8'));
const generatedAt = new Date();
const result = curateDigitelActivation(candidates, generatedAt);
const review = result.rows.filter((row) => row.decision === 'REVIEW');
const fail = result.rows.filter((row) => row.decision === 'FAIL');
const linked = result.pass.filter((event) => event.placeId);
const report = {
  dryRun: true, writes: 0, batchId, generatedAt: generatedAt.toISOString(), candidatesReviewed: result.rows.length,
  pass: result.pass.length, review: review.length, fail: fail.length,
  duplicateProviderIdentities: duplicateCount(result.pass.map((event) => `${event.provider}|${event.providerEventId}`)),
  duplicateFingerprints: duplicateCount(result.pass.map((event) => event.occurrenceFingerprint)),
  linkedToPlaces: linked.length, unlinked: result.pass.length - linked.length,
  categories: totals(result.pass.map((event) => event.category)),
  reasons: totals(result.rows.map((row) => `${row.decision}:${row.reason}`)),
  sourceImagesPublished: result.pass.filter((event) => event.imageUrl).length,
};
await mkdir(resolve(outputDir), { recursive: true });
await Promise.all([
  save('digitel-sprint9-pass.json', result.pass), save('digitel-sprint9-review.json', review),
  save('digitel-sprint9-fail.json', fail), save('digitel-sprint9-curation-all.json', result.rows),
  save('digitel-sprint9-dry-run-report.json', report),
  writeFile(resolve(outputDir, 'digitel-sprint9-import.sql'), buildActivationImportSql(result.pass, batchId, generatedAt.toISOString()), 'utf8'),
]);
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);

function valueAfter(flag) { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : null; }
function duplicateCount(values) { return values.length - new Set(values).size; }
function totals(values) { return Object.fromEntries([...new Set(values)].sort().map((value) => [value, values.filter((item) => item === value).length])); }
async function save(name, value) { await writeFile(resolve(outputDir, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8'); }
