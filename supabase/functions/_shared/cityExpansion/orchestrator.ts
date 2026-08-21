import type { AgentTask, ApprovalDecision, CityExpansionWorkflow, WorkflowStage } from './types.ts';

const tasks: AgentTask[] = [
  { id: 'city-profile', agent: 'city_expansion', stage: 'city_profile', status: 'queued', dependsOn: [], parallelGroup: 'foundation', productionWriteAllowed: false },
  { id: 'source-discovery', agent: 'source_discovery', stage: 'source_discovery', status: 'queued', dependsOn: [], parallelGroup: 'foundation', productionWriteAllowed: false },
  { id: 'source-review', agent: 'orchestrator', stage: 'source_review', status: 'queued', dependsOn: ['city-profile', 'source-discovery'], parallelGroup: null, productionWriteAllowed: false },
  { id: 'provider-analysis', agent: 'provider_integration', stage: 'provider_analysis', status: 'queued', dependsOn: ['source-review'], parallelGroup: null, productionWriteAllowed: false },
  { id: 'connector-draft', agent: 'provider_integration', stage: 'connector_draft', status: 'queued', dependsOn: ['provider-analysis'], parallelGroup: null, productionWriteAllowed: false },
  { id: 'dry-run', agent: 'provider_integration', stage: 'dry_run', status: 'queued', dependsOn: ['connector-draft'], parallelGroup: null, productionWriteAllowed: false },
  { id: 'quality-review', agent: 'event_quality', stage: 'quality_review', status: 'queued', dependsOn: ['dry-run'], parallelGroup: 'review', productionWriteAllowed: false },
  { id: 'localization-review', agent: 'localization', stage: 'localization_review', status: 'queued', dependsOn: ['city-profile'], parallelGroup: 'review', productionWriteAllowed: false },
  { id: 'expansion-scoring', agent: 'city_expansion', stage: 'expansion_scoring', status: 'queued', dependsOn: ['quality-review', 'localization-review'], parallelGroup: null, productionWriteAllowed: false },
  { id: 'human-approval', agent: 'orchestrator', stage: 'awaiting_human_approval', status: 'queued', dependsOn: ['expansion-scoring'], parallelGroup: null, productionWriteAllowed: false },
];

export function createCityExpansionWorkflow(runId: string, cityId: string): CityExpansionWorkflow {
  return {
    schemaVersion: '1.0', runId, workflowType: 'city_expansion', cityId,
    status: 'queued', currentStage: 'city_profile', riskLevel: 'medium', autonomyLevel: 2,
    tasks: tasks.map((task) => ({ ...task, dependsOn: [...task.dependsOn] })),
    approvalRequired: true, productionEnabled: false,
  };
}

export function runnableTaskIds(workflow: CityExpansionWorkflow): string[] {
  const completed = new Set(workflow.tasks.filter((task) => task.status === 'completed').map((task) => task.id));
  if (workflow.tasks.some((task) => task.status === 'failed' || task.status === 'blocked')) return [];
  return workflow.tasks.filter((task) => task.status === 'queued' && task.dependsOn.every((id) => completed.has(id))).map((task) => task.id);
}

export function finishTask(workflow: CityExpansionWorkflow, taskId: string, status: 'completed' | 'failed' | 'blocked'): CityExpansionWorkflow {
  const nextTasks = workflow.tasks.map((task) => task.id === taskId ? { ...task, status } : task);
  const changed = nextTasks.find((task) => task.id === taskId);
  if (!changed) throw new Error('Unknown agent task');
  const halted = status === 'failed' || status === 'blocked';
  return { ...workflow, tasks: nextTasks, status: halted ? status : workflow.status, currentStage: changed.stage };
}

export function requestHumanApproval(workflow: CityExpansionWorkflow): CityExpansionWorkflow {
  if (!workflow.tasks.filter((task) => task.id !== 'human-approval').every((task) => task.status === 'completed')) {
    throw new Error('Cannot request approval before all evidence stages complete');
  }
  return {
    ...workflow, status: 'awaiting_approval', currentStage: 'awaiting_human_approval',
    tasks: workflow.tasks.map((task) => task.id === 'human-approval' ? { ...task, status: 'awaiting_approval' } : task),
  };
}

export function applyHumanDecision(workflow: CityExpansionWorkflow, decision: ApprovalDecision, actor: { type: 'human' | 'agent'; id: string }): CityExpansionWorkflow {
  if (actor.type !== 'human') throw new Error('Agents cannot approve expansion workflows');
  if (workflow.currentStage !== 'awaiting_human_approval') throw new Error('No approval is pending');
  if (decision === 'REJECT') return { ...workflow, status: 'cancelled', currentStage: 'rejected' };
  if (decision === 'REQUEST_CHANGES') return { ...workflow, status: 'blocked', currentStage: 'source_review' };
  return { ...workflow, status: 'completed', currentStage: 'production_prepared', productionEnabled: false };
}

export function canEnterStage(workflow: CityExpansionWorkflow, stage: WorkflowStage): boolean {
  if (stage === 'production_enabled') return false;
  return workflow.currentStage === stage || workflow.tasks.some((task) => task.stage === stage);
}
