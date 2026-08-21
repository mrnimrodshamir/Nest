import type { AutonomyLevel } from './types.ts';

export type OwnerDecision = 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES';
export type ApprovalStatus = 'PENDING' | OwnerDecision;

export interface OwnerApprovalRequest {
  approvalId: string;
  runId: string;
  category: string;
  title: string;
  summary: string;
  whyNow: string;
  recommendedAction: string;
  riskLevel: 'low' | 'medium' | 'high';
  evidence: unknown;
  dryRunResults: unknown;
  expectedImpact: string;
  rollbackPlan: string;
  agentRecommendation: OwnerDecision;
  createdAt: string;
  status: ApprovalStatus;
}

export interface ApprovalDecisionActor { kind: 'owner' | 'agent'; id: string }

export function assertApprovalRequired(level: AutonomyLevel): void {
  if (level !== 'YELLOW') throw new Error(`Approval requests are only valid for Yellow actions; received ${level}`);
}

export function applyOwnerDecision(request: OwnerApprovalRequest, decision: OwnerDecision, actor: ApprovalDecisionActor): OwnerApprovalRequest {
  if (actor.kind !== 'owner') throw new Error('The operator cannot self-approve');
  if (request.status !== 'PENDING') throw new Error('Approval request already has a decision');
  return { ...request, status: decision };
}

export function formatOwnerInbox(request: OwnerApprovalRequest): string {
  return [
    'NESTUP OPERATOR — APPROVAL REQUIRED',
    `Issue:\n${request.title}`,
    `Summary:\n${request.summary}`,
    `Why now:\n${request.whyNow}`,
    `Expected impact:\n${request.expectedImpact}`,
    `Risk:\n${request.riskLevel.toUpperCase()}`,
    `Dry run:\n${summarize(request.dryRunResults)}`,
    `Recommendation:\n${request.agentRecommendation}`,
    'Actions:\n[APPROVE] [REJECT] [REQUEST CHANGES]',
  ].join('\n\n');
}

function summarize(value: unknown): string {
  if (value == null) return 'Not available';
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}
