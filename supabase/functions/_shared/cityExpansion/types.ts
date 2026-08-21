export const AGENT_NAMES = [
  'orchestrator', 'source_discovery', 'provider_integration',
  'event_quality', 'localization', 'city_expansion',
] as const;
export type AgentName = typeof AGENT_NAMES[number];

export const TASK_STATUSES = ['queued', 'running', 'completed', 'failed', 'blocked', 'awaiting_approval', 'cancelled'] as const;
export type AgentTaskStatus = typeof TASK_STATUSES[number];

export const WORKFLOW_STAGES = [
  'city_profile', 'source_discovery', 'source_review', 'provider_analysis',
  'connector_draft', 'dry_run', 'quality_review', 'localization_review',
  'expansion_scoring', 'awaiting_human_approval', 'approved', 'rejected',
  'production_prepared', 'production_enabled',
] as const;
export type WorkflowStage = typeof WORKFLOW_STAGES[number];

export type ApprovalGate = 'new_source' | 'global_quality_or_dedupe' | 'city_production_enablement' | 'localization_mass_change';
export type ApprovalDecision = 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES';

export interface AgentTask {
  id: string;
  agent: AgentName;
  stage: WorkflowStage;
  status: AgentTaskStatus;
  dependsOn: string[];
  parallelGroup: string | null;
  productionWriteAllowed: false;
}

export interface CityExpansionWorkflow {
  schemaVersion: '1.0';
  runId: string;
  workflowType: 'city_expansion';
  cityId: string;
  status: AgentTaskStatus;
  currentStage: WorkflowStage;
  riskLevel: 'low' | 'medium' | 'high';
  autonomyLevel: 1 | 2;
  tasks: AgentTask[];
  approvalRequired: true;
  productionEnabled: false;
}

export type DataAccessMethod = 'api' | 'rss' | 'json_ld' | 'structured_html' | 'html' | 'manual' | 'unknown';
export interface SourceCandidate {
  sourceId: string;
  sourceName: string;
  domain: string;
  sourceUrl: string;
  sourceType: string;
  organizationType: string;
  cityId: string;
  coverageEstimate: number;
  contentFrequency: 'daily' | 'weekly' | 'monthly' | 'irregular' | 'unknown';
  familyRelevance: number;
  dataAccessMethod: DataAccessMethod;
  structuredDataAvailability: number;
  sourceReliability: number;
  freshness: number;
  legalOperationalRisk: number;
  connectorComplexity: number;
  expectedEventYield: number;
  robotsLegalNotes: string;
  imageRightsNotes: string;
  registrationLinkAvailability: 'yes' | 'partial' | 'no' | 'unknown';
  locationQuality: number;
  priceDataQuality: number;
  ageDataQuality: number;
  confidenceScore: number;
  overallScore?: number;
  recommendedNextAction: 'analyze' | 'manual_review' | 'defer' | 'reject';
}

export interface ProviderSafetyContract {
  dryRun: true;
  failClosedSourceCompleteness: true;
  deterministicIdentity: true;
  idempotent: true;
  providerScopedWrites: true;
  noDestructiveActionOnPartialFetch: true;
  rsvpSafeLifecycle: true;
  observable: true;
}

export interface ProviderProposal {
  schemaVersion: '1.0';
  providerId: string;
  providerName: string;
  sourceUrl: string;
  connectorType: 'api' | 'rss' | 'json_ld' | 'html_extraction' | 'manual';
  fetchStrategy: string;
  paginationStrategy: string;
  stableIdentityStrategy: string;
  normalizationMapping: Record<string, string>;
  eventLifecycleHandling: string;
  sourceCompletenessRules: string[];
  failureModes: string[];
  imageRightsPolicy: string;
  dedupeInteraction: string;
  estimatedMaintenanceRisk: 'low' | 'medium' | 'high';
  safety: ProviderSafetyContract;
  productionEnabled: false;
}

export type DuplicateClass = 'EXACT' | 'PROBABLE' | 'AMBIGUOUS' | 'DISTINCT';
export interface QualityCandidate {
  id: string;
  provider: string;
  providerEventId: string | null;
  title: string;
  startsAt: string | null;
  endsAt: string | null;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  category: string | null;
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  priceNote: string | null;
  registrationUrl: string | null;
  familyRelevanceHint: boolean | null;
}

export interface QualityAssessment {
  eventId: string;
  qualityScore: number;
  publishRecommendation: 'PUBLISH' | 'REVIEW' | 'REJECT';
  reasons: string[];
  duplicateClass: DuplicateClass;
  categoryConfidence: number;
  ageConfidence: number;
  locationConfidence: number;
  priceConfidence: number;
  sourceConfidence: number;
  manualReviewRequired: boolean;
}

export interface ApprovalRequest {
  schemaVersion: '1.0';
  approvalId: string;
  runId: string;
  gate: ApprovalGate;
  decisionRequired: string;
  riskSummary: string[];
  proposedChanges: string[];
  evidence: string[];
  dryRunResults: Record<string, number>;
  requestedByAgent: AgentName;
  status: 'PENDING';
  productionActionTaken: false;
}
