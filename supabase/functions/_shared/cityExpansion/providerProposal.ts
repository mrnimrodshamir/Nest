import type { ProviderProposal } from './types.ts';

export function validateProviderProposal(proposal: ProviderProposal): string[] {
  const errors: string[] = [];
  if (!/^[a-z0-9_]+$/.test(proposal.providerId)) errors.push('provider_id_invalid');
  if (!proposal.sourceUrl.startsWith('https://')) errors.push('source_url_not_https');
  for (const [key, required] of Object.entries(proposal.safety)) if (required !== true) errors.push(`safety_${key}_missing`);
  if (proposal.productionEnabled !== false) errors.push('production_must_remain_disabled');
  if (!proposal.sourceCompletenessRules.length) errors.push('source_completeness_rules_missing');
  return errors;
}

export function assertDryRunOnly(proposal: ProviderProposal): void {
  const errors = validateProviderProposal(proposal);
  if (errors.length) throw new Error(`Unsafe provider proposal: ${errors.join(',')}`);
}
