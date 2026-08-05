import { readFileSync, writeFileSync } from 'node:fs';
import { extname, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { dryRunPlaceImport, parsePlacesCsv } from '../src/internal/placesImport.ts';

const args = process.argv.slice(2);
const inputArg = args.find((arg) => !arg.startsWith('--'));
const apply = args.includes('--apply');
const allowUpdates = args.includes('--allow-updates');
const confirmation = valueAfter('--confirm');
const existingPath = valueAfter('--existing');
const reportPath = valueAfter('--report');

if (!inputArg) fail('Usage: npm run places:import -- <dataset.csv|json> [--existing existing.json] [--report report.json] [--apply --confirm APPLY_PLACES]');
const inputPath = resolve(inputArg);
const raw = readFileSync(inputPath, 'utf8');
const parsed = extname(inputPath).toLowerCase() === '.csv' ? parsePlacesCsv(raw) : JSON.parse(raw);
if (!Array.isArray(parsed)) fail('Input JSON must be an array of place objects.');

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
let client = null;
let existing = existingPath ? JSON.parse(readFileSync(resolve(existingPath), 'utf8')) : [];

if (serviceKey && supabaseUrl) {
  client = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.from('places').select('id,name,slug,latitude,longitude,source_name,external_id,provider,provider_place_id');
  if (error) fail(`Could not read existing Places: ${error.message}`);
  existing = data.map((row) => ({ id: row.id, name: row.name, slug: row.slug, latitude: row.latitude, longitude: row.longitude, sourceName: row.source_name, externalId: row.external_id, provider: row.provider, providerPlaceId: row.provider_place_id }));
}

const result = dryRunPlaceImport(parsed, existing);
printReport(result);
if (reportPath) writeFileSync(resolve(reportPath), JSON.stringify(result, null, 2), { encoding: 'utf8', flag: 'wx' });

if (!apply) process.exit(result.summary.failed || result.summary.review ? 2 : 0);
if (confirmation !== 'APPLY_PLACES') fail('Apply requires --confirm APPLY_PLACES.');
if (!client || !serviceKey) fail('Apply requires EXPO_PUBLIC_SUPABASE_URL (or SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in the local environment.');
if (result.summary.failed || result.summary.review) fail('Apply blocked: every row must PASS and all review candidates must be resolved.');
if (result.summary.updates && !allowUpdates) fail('Apply contains updates. Re-run with --allow-updates after reviewing the generated report.');

const batchId = randomUUID();
const updates = result.upserts.filter((item) => item.operation === 'update');
if (updates.length) {
  const ids = updates.map((item) => item.targetId).filter(Boolean);
  const { data: before, error } = await client.from('places').select('*').in('id', ids);
  if (error) fail(`Could not capture update backup: ${error.message}`);
  const backupPath = resolve(`places-import-backup-${batchId}.json`);
  writeFileSync(backupPath, JSON.stringify({ batchId, rows: before }, null, 2), { encoding: 'utf8', flag: 'wx' });
  console.log(`Update backup created: ${backupPath}`);
}

for (const item of result.upserts) {
  const record = toDatabaseRecord(item.record, batchId);
  const response = item.operation === 'update'
    ? await client.from('places').update(record).eq('id', item.targetId)
    : await client.from('places').insert(record);
  if (response.error) fail(`Row ${item.row} ${item.operation} failed: ${response.error.message}. Batch: ${batchId}`);
}
console.log(`Import complete. Batch ID: ${batchId}. New rows can be cleaned up by import_batch_id after review.`);

function valueAfter(flag) { const index = args.indexOf(flag); return index >= 0 ? args[index + 1] : null; }
function fail(message) { console.error(message); process.exit(1); }
function printReport(result) {
  for (const row of result.rows) console.log(`${row.status} row ${row.row}${row.errors.length ? `: ${row.errors.join('; ')}` : ''}`);
  for (const duplicate of result.duplicates) console.log(`DUPLICATE row ${duplicate.row}: ${duplicate.kind} — ${duplicate.reason}`);
  for (const candidate of result.manualReview) console.log(`REVIEW row ${candidate.row}: ${candidate.reason} (${candidate.distanceMeters}m)`);
  console.log('Summary:', result.summary);
  console.log('Category totals:', result.categoryTotals);
  console.log('Neighborhood totals:', result.neighborhoodTotals);
}
function toDatabaseRecord(row, batchId) {
  return { ...row, city: 'Tel Aviv-Yafo', country_code: 'IL', is_active: true, import_batch_id: batchId, imported_at: new Date().toISOString() };
}
