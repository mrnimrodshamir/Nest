import type { AutonomyLevel } from './types.ts';

export const AUTONOMY_POLICY = {
  GREEN: [
    'add_regression_test', 'improve_internal_diagnostic', 'fix_deterministic_parser',
    'fix_unambiguous_normalization', 'repair_documentation', 'produce_quality_report',
    'produce_source_research', 'prepare_dry_run_connector',
  ],
  YELLOW: [
    'new_provider', 'new_city', 'provider_cron', 'production_data_correction',
    'meaningful_ui_change', 'notification_behavior', 'localization_policy_change',
  ],
  RED: [
    'destructive_migration', 'weaken_rls', 'drop_constraint', 'delete_user_data',
    'delete_rsvp_data', 'global_dedupe_change', 'mass_production_mutation',
    'force_push', 'app_store_submission', 'production_release', 'bypass_source_protection',
  ],
} as const;

const lookup = new Map<string, AutonomyLevel>(Object.entries(AUTONOMY_POLICY).flatMap(([level, actions]) => actions.map((action) => [action, level as AutonomyLevel])));

export function autonomyFor(action: string): AutonomyLevel {
  return lookup.get(action) ?? 'YELLOW';
}

export function mayExecute(action: string, approved = false): boolean {
  const level = autonomyFor(action);
  return level === 'GREEN' || (level === 'YELLOW' && approved);
}

export function assertAutonomousAction(action: string, approved = false): void {
  if (!mayExecute(action, approved)) throw new Error(`${autonomyFor(action)} action requires human authority: ${action}`);
}
