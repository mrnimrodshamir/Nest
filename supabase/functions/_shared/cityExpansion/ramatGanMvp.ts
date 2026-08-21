import { assessEventQuality } from './quality.ts';
import { validateLocalizationPlan, type LocalizationPlan } from './localization.ts';
import { createCityExpansionWorkflow, finishTask, requestHumanApproval } from './orchestrator.ts';
import { assertDryRunOnly } from './providerProposal.ts';
import { scoreExpansionReadiness } from './readiness.ts';
import { rankSourceCandidates } from './sourceDiscovery.ts';
import type { ApprovalRequest, ProviderProposal, QualityCandidate, SourceCandidate } from './types.ts';

export const RAMAT_GAN_RUN_ID = 'ramat-gan-assisted-2026-08-21';

export const ramatGanSources: SourceCandidate[] = [
  {
    sourceId: 'ramat_gan_beit_emanuel', sourceName: 'בית עמנואל רמת גן', domain: 'mbe-rg.smarticket.co.il', sourceUrl: 'https://mbe-rg.smarticket.co.il/',
    sourceType: 'municipal_community_events', organizationType: 'municipal_corporation', cityId: 'ramat_gan', coverageEstimate: 92, contentFrequency: 'daily', familyRelevance: 96,
    dataAccessMethod: 'structured_html', structuredDataAvailability: 82, sourceReliability: 88, freshness: 95, legalOperationalRisk: 32, connectorComplexity: 48, expectedEventYield: 95,
    robotsLegalNotes: 'Public official ticketing pages; terms and automated access require human legal review before connector approval.', imageRightsNotes: 'Do not ingest images until explicit reuse rights are documented.',
    registrationLinkAvailability: 'yes', locationQuality: 82, priceDataQuality: 68, ageDataQuality: 86, confidenceScore: 92, recommendedNextAction: 'analyze',
  },
  {
    sourceId: 'ramat_gan_museum', sourceName: 'מוזיאון רמת גן לאמנות ישראלית', domain: 'rgma.smarticket.co.il', sourceUrl: 'https://rgma.smarticket.co.il/',
    sourceType: 'museum_events', organizationType: 'municipal_museum', cityId: 'ramat_gan', coverageEstimate: 72, contentFrequency: 'weekly', familyRelevance: 82,
    dataAccessMethod: 'structured_html', structuredDataAvailability: 80, sourceReliability: 92, freshness: 88, legalOperationalRisk: 30, connectorComplexity: 45, expectedEventYield: 60,
    robotsLegalNotes: 'Official museum ticketing pages; connector requires source approval and terms review.', imageRightsNotes: 'Event photography requires explicit license; metadata only by default.',
    registrationLinkAvailability: 'yes', locationQuality: 90, priceDataQuality: 75, ageDataQuality: 76, confidenceScore: 90, recommendedNextAction: 'analyze',
  },
  {
    sourceId: 'ramat_gan_safari', sourceName: 'הספארי ברמת גן', domain: 'safari.co.il', sourceUrl: 'https://www.safari.co.il/',
    sourceType: 'zoo_events', organizationType: 'public_zoological_center', cityId: 'ramat_gan', coverageEstimate: 52, contentFrequency: 'irregular', familyRelevance: 95,
    dataAccessMethod: 'html', structuredDataAvailability: 42, sourceReliability: 90, freshness: 66, legalOperationalRisk: 38, connectorComplexity: 65, expectedEventYield: 48,
    robotsLegalNotes: 'Official public pages; no structured feed confirmed. Human review required.', imageRightsNotes: 'No image reuse without written license.', registrationLinkAvailability: 'partial',
    locationQuality: 95, priceDataQuality: 65, ageDataQuality: 55, confidenceScore: 78, recommendedNextAction: 'manual_review',
  },
  {
    sourceId: 'ramat_gan_man_and_living', sourceName: 'מוזיאון האדם והחי', domain: 'adamvechai.org.il', sourceUrl: 'https://adamvechai.org.il/events/',
    sourceType: 'museum_events', organizationType: 'municipally_supported_museum', cityId: 'ramat_gan', coverageEstimate: 45, contentFrequency: 'monthly', familyRelevance: 91,
    dataAccessMethod: 'html', structuredDataAvailability: 35, sourceReliability: 82, freshness: 64, legalOperationalRisk: 35, connectorComplexity: 70, expectedEventYield: 38,
    robotsLegalNotes: 'Official public site; no API/RSS confirmed.', imageRightsNotes: 'Do not republish site imagery without permission.', registrationLinkAvailability: 'partial',
    locationQuality: 90, priceDataQuality: 48, ageDataQuality: 72, confidenceScore: 76, recommendedNextAction: 'manual_review',
  },
  {
    sourceId: 'ramat_gan_national_park', sourceName: 'הפארק הלאומי רמת גן', domain: 'nprg.co.il', sourceUrl: 'https://www.nprg.co.il/events',
    sourceType: 'park_events', organizationType: 'municipal_park_authority', cityId: 'ramat_gan', coverageEstimate: 40, contentFrequency: 'irregular', familyRelevance: 80,
    dataAccessMethod: 'html', structuredDataAvailability: 30, sourceReliability: 85, freshness: 58, legalOperationalRisk: 30, connectorComplexity: 72, expectedEventYield: 32,
    robotsLegalNotes: 'Official public park events page; no structured feed confirmed.', imageRightsNotes: 'Metadata only until image rights are approved.', registrationLinkAvailability: 'partial',
    locationQuality: 95, priceDataQuality: 35, ageDataQuality: 30, confidenceScore: 70, recommendedNextAction: 'defer',
  },
  {
    sourceId: 'ramat_gan_city_tickets', sourceName: 'אירועי עיריית רמת גן', domain: 'ramat-gan.smarticket.co.il', sourceUrl: 'https://ramat-gan.smarticket.co.il/',
    sourceType: 'municipal_events', organizationType: 'municipality', cityId: 'ramat_gan', coverageEstimate: 60, contentFrequency: 'weekly', familyRelevance: 55,
    dataAccessMethod: 'structured_html', structuredDataAvailability: 78, sourceReliability: 88, freshness: 85, legalOperationalRisk: 32, connectorComplexity: 48, expectedEventYield: 58,
    robotsLegalNotes: 'Official public ticketing portal; broad adult content requires strict family relevance filtering.', imageRightsNotes: 'No image reuse without documented license.', registrationLinkAvailability: 'yes',
    locationQuality: 80, priceDataQuality: 65, ageDataQuality: 45, confidenceScore: 82, recommendedNextAction: 'manual_review',
  },
];

export const ramatGanProviderProposal: ProviderProposal = {
  schemaVersion: '1.0', providerId: 'ramat_gan_beit_emanuel', providerName: 'בית עמנואל רמת גן', sourceUrl: 'https://mbe-rg.smarticket.co.il/', connectorType: 'html_extraction',
  fetchStrategy: 'Read public listing pages and approved detail pages with bounded concurrency, retries, timeout, and a pinned parser fixture.',
  paginationStrategy: 'Follow only same-origin listing pagination discovered from the approved starting page; stop on repeated page identity or configured cap.',
  stableIdentityStrategy: 'Use the Smarticket numeric detail-page id plus occurrence start; never derive identity from mutable title or description.',
  normalizationMapping: { title: 'listing/detail title', starts_at: 'occurrence date and time', location_name: 'venue label', age_range: 'explicit age text only', registration_url: 'canonical same-origin detail URL', price_note: 'explicit displayed price only' },
  eventLifecycleHandling: 'Provider-present records update in place. Missing reconciliation runs only after a complete successful fetch and preserves RSVP-linked occurrences.',
  sourceCompletenessRules: ['all listing pages fetched', 'no repeated pagination token', 'response count below configured safety ceiling is investigated', 'any parse/schema drift marks source_complete=false'],
  failureModes: ['timeout', 'HTTP error', 'markup drift', 'pagination loop', 'partial detail fetch', 'unexpected event volume'],
  imageRightsPolicy: 'Do not ingest or republish provider images until written rights are recorded in the content image pipeline.',
  dedupeInteraction: 'Provider-native ID is primary; cross-provider mirrors remain quality candidates and ambiguous matches require review.', estimatedMaintenanceRisk: 'medium',
  safety: { dryRun: true, failClosedSourceCompleteness: true, deterministicIdentity: true, idempotent: true, providerScopedWrites: true, noDestructiveActionOnPartialFetch: true, rsvpSafeLifecycle: true, observable: true },
  productionEnabled: false,
};

const qualityCandidates: QualityCandidate[] = [
  { id: 'sample-22699', provider: 'ramat_gan_beit_emanuel', providerEventId: '22699', title: 'מיוזיכייף – חוויה מוזיקלית לקטנטנים בגילאי שנה וחצי עד שלוש', startsAt: '2026-08-18T07:00:00Z', endsAt: null, locationName: 'בית דורון', latitude: 32.084, longitude: 34.82, category: 'community', ageMinMonths: 18, ageMaxMonths: 36, priceNote: null, registrationUrl: 'https://mbe-rg.smarticket.co.il/?id=22699', familyRelevanceHint: true },
  { id: 'sample-22752', provider: 'ramat_gan_beit_emanuel', providerEventId: '22752', title: 'פעילות מוזיקלית עם דן דן הנגן לגילאי זחילה עד הליכה', startsAt: '2026-08-24T13:30:00Z', endsAt: null, locationName: 'משחקיית ר״געים', latitude: 32.081, longitude: 34.818, category: 'community', ageMinMonths: 6, ageMaxMonths: 18, priceNote: null, registrationUrl: 'https://mbe-rg.smarticket.co.il/?id=22752', familyRelevanceHint: true },
  { id: 'sample-23233', provider: 'ramat_gan_beit_emanuel', providerEventId: '23233', title: 'באהבה לסביבה – שוק, סדנה והצגה', startsAt: '2026-08-23T13:00:00Z', endsAt: null, locationName: 'בית הצנחן', latitude: 32.08, longitude: 34.815, category: 'workshop', ageMinMonths: null, ageMaxMonths: null, priceNote: null, registrationUrl: 'https://mbe-rg.smarticket.co.il/?id=23233', familyRelevanceHint: true },
  { id: 'sample-test', provider: 'ramat_gan_beit_emanuel', providerEventId: '14703', title: 'טסט למופע רב אירועים לאתר העירוני', startsAt: '2026-08-26T09:00:00Z', endsAt: null, locationName: 'אודיטוריום מוזיאון רמת גן', latitude: null, longitude: null, category: null, ageMinMonths: null, ageMaxMonths: null, priceNote: null, registrationUrl: 'https://mbe-rg.smarticket.co.il/?id=14703', familyRelevanceHint: null },
];

export function buildRamatGanMvpArtifacts() {
  const sources = rankSourceCandidates(ramatGanSources);
  assertDryRunOnly(ramatGanProviderProposal);
  const assessments = qualityCandidates.map((candidate, index) => assessEventQuality(candidate, qualityCandidates.slice(0, index)));
  const dryRun = {
    schemaVersion: '1.0', mode: 'captured_public_sample', sourceComplete: true, productionWrites: 0,
    fetched: 4, normalized: 4, relevant: 3, excluded: 1, invalid: 0,
    new: 0, updated: 0, unchanged: 0, missing: 0, archived: 0,
    duplicateExact: 0, duplicateProbable: 0, duplicateAmbiguous: 0, distinct: 4,
    sampleEvents: qualityCandidates.map((candidate) => ({ id: candidate.id, title: candidate.title, startsAt: candidate.startsAt, locationName: candidate.locationName })),
    excludedRecords: [{ id: 'sample-test', reasons: ['test_or_placeholder_content', 'manual_review_required'] }],
    limitations: ['Captured sample only; no live connector exists.', 'No production comparison or source-wide completeness claim.'],
  };
  const cityProfile = {
    schemaVersion: '1.0', cityId: 'ramat_gan', displayNames: { en: 'Ramat Gan', he: 'רמת גן', fr: 'Ramat Gan', ru: 'Рамат-Ган', ar: 'رمات غان', es: 'Ramat Gan' },
    country: 'IL', timezone: 'Asia/Jerusalem', currency: 'ILS', preferredLanguages: ['he', 'en', 'ar', 'ru', 'fr', 'es'],
    geographicBounds: { south: 32.0360822, west: 34.7991359, north: 32.105566, east: 34.8547491, status: 'authoritative_official_gis', sourceCode: '8600', sourceUrl: 'https://ags.iplan.gov.il/arcgisiplan/rest/services/PlanningPublic/gvulot_retzef/MapServer/1' },
    neighborhoods: ['מרום נווה', 'רמת חן', 'רמת יצחק', 'קריית קריניצי', 'רמת אפעל', 'רמת השקמה', 'חרוזים'],
    familyHubs: ['הפארק הלאומי', 'הספארי', 'בית עמנואל והמרכזים הקהילתיים', 'מוזיאון רמת גן', 'מוזיאון האדם והחי'],
    defaultRadiusKm: 5, transportNotes: ['Dense border with Tel Aviv and Givatayim requires city-aware filtering without hiding nearby content.'],
  };
  const localizationPlan: LocalizationPlan = {
    schemaVersion: '1.0', cityId: 'ramat_gan', cityDisplayNames: cityProfile.displayNames,
    placeNames: [{ source: 'הפארק הלאומי רמת גן', localized: { he: 'הפארק הלאומי רמת גן', en: 'Ramat Gan National Park' }, confidence: 95, requiresReview: false }],
    neighborhoodNames: cityProfile.neighborhoods.map((name) => ({ source: name, localized: { he: name }, confidence: 100, requiresReview: true })),
    sourceDisplayNames: sources.slice(0, 2).map((source) => ({ source: source.sourceName, localized: { he: source.sourceName }, confidence: 100, requiresReview: true })),
    categoryLabels: {}, preservedContentKinds: ['user_generated', 'user_names', 'child_names', 'provider_titles_and_descriptions', 'unknown_proper_nouns'],
    unresolvedNames: ['Official multilingual neighborhood names', 'Provider legal display names outside Hebrew'],
  };
  if (validateLocalizationPlan(localizationPlan).length) throw new Error('Invalid localization plan');
  const readiness = scoreExpansionReadiness({ contentCoverage: 68, providerQuality: 76, technicalComplexity: 66, localizationReadiness: 62, geographicDataQuality: 55, expectedFamilyDemand: 78, operationalRisk: 48 });
  const providerAnalyses = {
    schemaVersion: '1.0',
    analyses: [
      {
        sourceId: 'ramat_gan_beit_emanuel', rank: 1, connectorType: 'html_extraction', stableIdsObserved: true,
        pagination: 'requires_fixture_validation', detailPages: true, registrationLinks: true, ageData: 'frequent_explicit_text', priceData: 'partial',
        recommendation: 'DRAFT_CONNECTOR_AFTER_GATE_A', risk: 'medium',
      },
      {
        sourceId: 'ramat_gan_museum', rank: 2, connectorType: 'html_extraction', stableIdsObserved: true,
        pagination: 'recurring_occurrence_expansion_requires_validation', detailPages: true, registrationLinks: true, ageData: 'partial', priceData: 'partial',
        recommendation: 'ANALYZE_FIXTURES_AFTER_PRIMARY_SOURCE', risk: 'medium',
      },
    ],
  };
  const approvalRequest: ApprovalRequest = {
    schemaVersion: '1.0', approvalId: 'approval-ramat-gan-source-001', runId: RAMAT_GAN_RUN_ID, gate: 'new_source',
    decisionRequired: 'Approve or reject connector development and a future production dry run for ramat_gan_beit_emanuel.',
    riskSummary: ['Public structured endpoint/markup requires monitoring', 'Image rights not approved and images remain excluded'],
    proposedChanges: ['Develop connector behind disabled provider_registry row', 'Run fixture and non-production dry runs only'],
    evidence: ['city-profile.json', 'source-candidates.json', 'provider-analyses.json', 'provider-proposal.json', 'dry-run.json', 'quality-report.json', 'localization-plan.json', 'expansion-readiness.json'],
    dryRunResults: { fetched: 4, normalized: 4, relevant: 3, excluded: 1, productionWrites: 0 },
    requestedByAgent: 'orchestrator', status: 'PENDING', productionActionTaken: false,
  };
  let workflow = createCityExpansionWorkflow(RAMAT_GAN_RUN_ID, 'ramat_gan');
  for (const task of workflow.tasks.filter((task) => task.id !== 'human-approval')) workflow = finishTask(workflow, task.id, 'completed');
  workflow = requestHumanApproval(workflow);
  return { workflow, cityProfile, sources, providerAnalyses, providerProposal: ramatGanProviderProposal, dryRun, qualityReport: { schemaVersion: '1.0', assessments }, localizationPlan, readiness: { schemaVersion: '1.0', ...readiness }, approvalRequest };
}
