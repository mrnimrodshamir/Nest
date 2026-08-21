import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { buildRamatGanMvpArtifacts } from '../supabase/functions/_shared/cityExpansion/ramatGanMvp.ts';

const outputDir = resolve(process.cwd(), 'docs/city-expansion/ramat-gan');
const artifacts = buildRamatGanMvpArtifacts();
const files = {
  'workflow.json': artifacts.workflow,
  'city-profile.json': artifacts.cityProfile,
  'source-candidates.json': { schemaVersion: '1.0', candidates: artifacts.sources },
  'provider-analyses.json': artifacts.providerAnalyses,
  'provider-proposal.json': artifacts.providerProposal,
  'dry-run.json': artifacts.dryRun,
  'quality-report.json': artifacts.qualityReport,
  'localization-plan.json': artifacts.localizationPlan,
  'expansion-readiness.json': artifacts.readiness,
  'approval-request.json': artifacts.approvalRequest,
};
await mkdir(outputDir, { recursive: true });
for (const [name, value] of Object.entries(files)) await writeFile(resolve(outputDir, name), `${JSON.stringify(value, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ mode: 'dry_run', outputDir, files: Object.keys(files), productionWrites: 0 }));
