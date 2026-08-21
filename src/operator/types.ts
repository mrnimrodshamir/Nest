export type OperatorMode = 'quick_check' | 'daily' | 'deep_audit' | 'city_expansion' | 'source_hunt' | 'bug_hunt';
export type AutonomyLevel = 'GREEN' | 'YELLOW' | 'RED';
export type FindingPriority = 'P0' | 'P1' | 'P2' | 'P3';

export interface HealthSignal {
  id: string;
  label: string;
  value: number;
  weight: number;
  reason?: string;
}

export interface HealthScore {
  score: number;
  signals: Array<HealthSignal & { deduction: number }>;
  deductions: string[];
}

export interface OperatorFinding {
  id: string;
  domain: 'product' | 'content' | 'provider' | 'security' | 'coverage';
  priority: FindingPriority;
  title: string;
  evidence: string;
  severity: number;
  userImpact: number;
  confidence: number;
  reach: number;
  implementationRisk: number;
  autonomy: AutonomyLevel;
  score?: number;
}

export interface ProviderRunSnapshot {
  provider: string;
  status: 'running' | 'success' | 'partial' | 'failed';
  sourceComplete: boolean;
  fetched: number;
  normalized: number;
  duplicates: number;
  invalidOrErrors: number;
  archived: number;
  startedAt: string;
  completedAt: string | null;
}

export interface ProviderSnapshot {
  key: string;
  cityId: string;
  enabled: boolean;
  scheduleCron: string | null;
  cronActive: boolean;
  cronMatches?: number;
  intentionallyParked?: boolean;
  runs: ProviderRunSnapshot[];
}

export interface ContentCandidate {
  id: string;
  cityId: string;
  provider: string;
  title: string;
  description?: string | null;
  startsAt: string;
  endsAt: string | null;
  category: string | null;
  ageMinMonths: number | null;
  ageMaxMonths: number | null;
  priceNote: string | null;
  latitude: number | null;
  longitude: number | null;
  sourceUrl: string | null;
  registrationUrl: string | null;
  eventStatus: string | null;
  occurrenceFingerprint: string | null;
}

export interface OperatorRunPlan {
  mode: OperatorMode;
  capabilities: readonly string[];
  productionWrites: false;
  schedulesEnabled: false;
}
