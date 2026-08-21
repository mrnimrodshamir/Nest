import type { OperatorMode } from './types.ts';

export const OPERATOR_SCHEDULES = {
  daily: { name: 'nestup-operator-daily', cron: '15 3 * * *', mode: 'daily' },
  weekly: { name: 'nestup-operator-weekly-source-hunt', cron: '30 3 * * 1', mode: 'source_hunt' },
} as const;

export function assertScheduledMode(mode: OperatorMode): asserts mode is 'daily' | 'source_hunt' {
  if (mode !== 'daily' && mode !== 'source_hunt') throw new Error(`Mode ${mode} is not permitted for unattended execution`);
}

export function scheduledRunMayAct(autonomy: 'GREEN' | 'YELLOW' | 'RED'): boolean {
  return autonomy === 'GREEN';
}
