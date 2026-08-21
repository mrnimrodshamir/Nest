import type { OperatorMode, OperatorRunPlan } from './types.ts';

const CAPABILITIES = {
  observe_product: ['quick_check', 'daily', 'deep_audit', 'bug_hunt'],
  observe_content: ['daily', 'deep_audit', 'city_expansion', 'source_hunt'],
  inspect_providers: ['daily', 'deep_audit', 'city_expansion', 'source_hunt'],
  security_watch: ['deep_audit'],
  source_discovery: ['city_expansion', 'source_hunt'],
  bug_investigation: ['deep_audit', 'bug_hunt'],
  persist_audit: ['quick_check', 'daily', 'deep_audit', 'city_expansion', 'source_hunt', 'bug_hunt'],
} as const;

export function createOperatorPlan(mode: OperatorMode): OperatorRunPlan {
  const capabilities = Object.entries(CAPABILITIES).filter(([, modes]) => (modes as readonly string[]).includes(mode)).map(([capability]) => capability);
  return { mode, capabilities, productionWrites: false, schedulesEnabled: false };
}

export const OPERATING_LOOP = ['OBSERVE','DETECT','PRIORITIZE','INVESTIGATE','PLAN','EXECUTE_SAFE_ACTIONS','VERIFY','REPORT','WAIT_OR_CONTINUE'] as const;

export interface CapabilityResult<T = unknown> { capability: string; status: 'success' | 'failed'; value?: T; error?: string }

export async function executeCapabilitySet<T>(capabilities: readonly string[], executors: Record<string, () => Promise<T>>): Promise<CapabilityResult<T>[]> {
  const settled = await Promise.allSettled(capabilities.map((capability) => executors[capability]?.() ?? Promise.reject(new Error('Capability is not registered'))));
  return settled.map((result, index) => result.status === 'fulfilled'
    ? { capability: capabilities[index], status: 'success', value: result.value }
    : { capability: capabilities[index], status: 'failed', error: safeError(result.reason) });
}

function safeError(reason: unknown): string {
  return reason instanceof Error ? reason.message.slice(0, 200) : 'Capability failed';
}
