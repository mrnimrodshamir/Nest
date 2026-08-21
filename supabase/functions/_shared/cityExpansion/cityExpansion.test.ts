import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyHumanDecision, createCityExpansionWorkflow, finishTask, requestHumanApproval, runnableTaskIds } from './orchestrator.ts';
import { assessEventQuality, classifyDuplicate } from './quality.ts';
import { validateProviderProposal } from './providerProposal.ts';
import { shouldPreserveVerbatim, validateLocalizationPlan } from './localization.ts';
import { scoreExpansionReadiness } from './readiness.ts';
import { artifactContainsSecretField, assertProductionActionAllowed, sanitizeArtifact } from './security.ts';
import { buildRamatGanMvpArtifacts, ramatGanProviderProposal, ramatGanSources } from './ramatGanMvp.ts';
import { rankSourceCandidates } from './sourceDiscovery.ts';
import type { QualityCandidate } from './types.ts';

const quality = (overrides: Partial<QualityCandidate> = {}): QualityCandidate => ({
  id: 'a', provider: 'provider', providerEventId: '1', title: 'Family workshop', startsAt: '2026-09-01T10:00:00Z', endsAt: '2026-09-01T11:00:00Z',
  locationName: 'Museum', latitude: 32.08, longitude: 34.82, category: 'workshop', ageMinMonths: 36, ageMaxMonths: 96,
  priceNote: '20 ILS', registrationUrl: 'https://example.org/event', familyRelevanceHint: true, ...overrides,
});

test('orchestrator starts independent foundation tasks in parallel and preserves stage ordering', () => {
  let workflow = createCityExpansionWorkflow('run', 'ramat_gan');
  assert.deepEqual(runnableTaskIds(workflow).sort(), ['city-profile', 'source-discovery']);
  workflow = finishTask(workflow, 'city-profile', 'completed');
  assert.deepEqual(runnableTaskIds(workflow).sort(), ['localization-review', 'source-discovery']);
  workflow = finishTask(workflow, 'source-discovery', 'completed');
  assert.deepEqual(runnableTaskIds(workflow).sort(), ['localization-review', 'source-review']);
});

test('failed or blocked task stops all downstream work', () => {
  const workflow = finishTask(createCityExpansionWorkflow('run', 'ramat_gan'), 'source-discovery', 'blocked');
  assert.deepEqual(runnableTaskIds(workflow), []);
});

test('approval cannot be requested early and an agent can never self-approve', () => {
  const workflow = createCityExpansionWorkflow('run', 'ramat_gan');
  assert.throws(() => requestHumanApproval(workflow));
  const ready = buildRamatGanMvpArtifacts().workflow;
  assert.throws(() => applyHumanDecision(ready, 'APPROVE', { type: 'agent', id: 'orchestrator' }), /cannot approve/i);
});

test('human rejection halts; approval reaches production-prepared but never production-enabled', () => {
  const ready = buildRamatGanMvpArtifacts().workflow;
  assert.equal(applyHumanDecision(ready, 'REJECT', { type: 'human', id: 'admin' }).currentStage, 'rejected');
  const approved = applyHumanDecision(ready, 'APPROVE', { type: 'human', id: 'admin' });
  assert.equal(approved.currentStage, 'production_prepared');
  assert.equal(approved.productionEnabled, false);
});

test('source discovery ranks high-value official candidates, removes duplicates, and rejects low confidence', () => {
  const ranked = rankSourceCandidates([...ramatGanSources, { ...ramatGanSources[0], sourceId: 'duplicate' }, { ...ramatGanSources[0], sourceId: 'low', domain: 'low.example', confidenceScore: 5 }]);
  assert.equal(ranked[0].sourceId, 'ramat_gan_beit_emanuel');
  assert.equal(ranked.filter((source) => source.domain === 'mbe-rg.smarticket.co.il').length, 1);
  assert.ok(!ranked.some((source) => source.sourceId === 'low'));
});

test('provider proposal requires every fail-closed safety capability and stays disabled', () => {
  assert.deepEqual(validateProviderProposal(ramatGanProviderProposal), []);
  assert.ok(ramatGanProviderProposal.sourceCompletenessRules.length >= 3);
  assert.equal(ramatGanProviderProposal.productionEnabled, false);
});

test('quality duplicate classes cover exact, probable, ambiguous, and distinct without auto-merging ambiguity', () => {
  const base = quality();
  assert.equal(classifyDuplicate(base, quality({ id: 'b' })), 'EXACT');
  assert.equal(classifyDuplicate(base, quality({ id: 'b', provider: 'other', providerEventId: 'x' })), 'PROBABLE');
  assert.equal(classifyDuplicate(base, quality({ id: 'b', provider: 'other', providerEventId: 'x', startsAt: '2026-09-01T15:00:00Z' })), 'AMBIGUOUS');
  assert.equal(classifyDuplicate(base, quality({ id: 'b', provider: 'other', providerEventId: 'x', title: 'Different', startsAt: '2026-09-02T15:00:00Z', locationName: 'Elsewhere' })), 'DISTINCT');
});

test('bad events are excluded while ambiguous records remain manual review', () => {
  const bad = assessEventQuality(quality({ title: 'טסט', startsAt: null, locationName: null, latitude: null, longitude: null }));
  assert.equal(bad.publishRecommendation, 'REJECT');
  const ambiguous = assessEventQuality(quality({ id: 'b', provider: 'other', providerEventId: 'x', startsAt: '2026-09-01T15:00:00Z' }), [quality()]);
  assert.equal(ambiguous.duplicateClass, 'AMBIGUOUS');
  assert.equal(ambiguous.manualReviewRequired, true);
});

test('localization preserves user/provider content and identifies incomplete locale coverage', () => {
  for (const kind of ['user_content', 'user_name', 'child_name', 'provider_title', 'provider_description'] as const) assert.equal(shouldPreserveVerbatim(kind), true);
  const plan = buildRamatGanMvpArtifacts().localizationPlan;
  assert.deepEqual(validateLocalizationPlan(plan), []);
  assert.ok(plan.unresolvedNames.length > 0);
});

test('readiness produces conditional GO for incomplete providers/localization/geography', () => {
  const result = scoreExpansionReadiness({ contentCoverage: 68, providerQuality: 76, technicalComplexity: 66, localizationReadiness: 62, geographicDataQuality: 55, expectedFamilyDemand: 78, operationalRisk: 48 });
  assert.equal(result.recommendation, 'CONDITIONAL_GO');
  assert.ok(result.reasons.includes('geographic_bounds_require_validation'));
});

test('security removes secret fields and blocks production actions without human approval', () => {
  const sanitized = sanitizeArtifact({ city: 'ramat_gan', access_token: 'secret', nested: { privateKey: 'secret', ok: true } });
  assert.equal(artifactContainsSecretField(sanitized), false);
  assert.throws(() => assertProductionActionAllowed({ action: 'production_write', approvalStatus: 'PENDING', actorType: 'agent' }));
  assert.doesNotThrow(() => assertProductionActionAllowed({ action: 'production_write', approvalStatus: 'APPROVED', actorType: 'human' }));
});

test('Ramat Gan MVP stops at a pending human approval with zero production writes', () => {
  const artifacts = buildRamatGanMvpArtifacts();
  assert.equal(artifacts.sources.length, 6);
  assert.deepEqual(artifacts.sources.slice(0, 2).map((source) => source.sourceId), ['ramat_gan_beit_emanuel', 'ramat_gan_museum']);
  assert.equal(artifacts.dryRun.productionWrites, 0);
  assert.equal(artifacts.providerAnalyses.analyses.length, 2);
  assert.equal(artifacts.dryRun.sampleEvents.length, 4);
  assert.equal(artifacts.approvalRequest.status, 'PENDING');
  assert.equal(artifacts.workflow.currentStage, 'awaiting_human_approval');
  assert.equal(artifacts.workflow.productionEnabled, false);
});

test('committed artifacts are reproducible and the local migration cannot enable production', () => {
  const generated = buildRamatGanMvpArtifacts();
  const artifact = JSON.parse(readFileSync(new URL('../../../../docs/city-expansion/ramat-gan/approval-request.json', import.meta.url), 'utf8'));
  assert.deepEqual(artifact, generated.approvalRequest);
  const migration = readFileSync(new URL('../../../migrations/20260821120000_city_expansion_agent_control_plane.sql', import.meta.url), 'utf8');
  const executable = migration.replace(/--.*$/gm, '');
  assert.ok(!executable.includes("'production_enabled'"), 'MVP migration permits production enablement');
  assert.match(migration, /enable row level security/g);
  assert.match(migration, /grant select, insert on public\.approval_requests to service_role/);
  assert.ok(!/grant[^;]*update[^;]*approval_requests/i.test(migration), 'agents can update approvals');
});
