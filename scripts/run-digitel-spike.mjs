import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fetchAllDigitelFeatures, normalizeDigitelFeatures } from '../src/integrations/digitelConnector.ts';
import { buildDigitelDryRunReport } from '../src/integrations/digitelReport.ts';

const args = new Map(process.argv.slice(2).map((value, index, values) => value.startsWith('--') ? [value, values[index + 1]] : null).filter(Boolean));
const outputPath = args.get('--output');
const historyDays = Number(args.get('--history-days') ?? 30);
const pageSize = Number(args.get('--page-size') ?? 500);

const fetched = await fetchAllDigitelFeatures({ pageSize });
const generatedAt = new Date();
const normalized = normalizeDigitelFeatures(fetched.features, { historyDays, now: generatedAt });
const report = {
  endpoint: fetched.requestUrls[0]?.split('?')[0],
  pagesFetched: fetched.pages,
  pageSize,
  historyDays,
  queryParameters: Object.fromEntries(new URL(fetched.requestUrls[0]).searchParams.entries()),
  ...buildDigitelDryRunReport(fetched.features, normalized, generatedAt),
};
const json = `${JSON.stringify(report, null, 2)}\n`;
if (outputPath) await writeFile(resolve(outputPath), json, 'utf8');
process.stdout.write(json);
