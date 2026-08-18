/** The same "is this provider allowed to run" guard the generic SQL
 *  reconciliation function enforces (`apply_complete_provider_sync` raises if
 *  `provider_registry.enabled` is false), mirrored here so it is checked
 *  BEFORE a fetch is even attempted, not only at the final write. A disabled
 *  provider — Beit Ariela, until a human turns it on — should never make a
 *  live HTTP request from an automated run, let alone reach the database. */
export interface ProviderRegistryRow {
  key: string;
  enabled: boolean;
}

export class ProviderDisabledError extends Error {
  constructor(providerKey: string) {
    super(`Provider "${providerKey}" is disabled in provider_registry and may not sync`);
    this.name = 'ProviderDisabledError';
  }
}

export function assertProviderEnabled(row: ProviderRegistryRow | null): void {
  if (!row) throw new ProviderDisabledError('(unknown)');
  if (!row.enabled) throw new ProviderDisabledError(row.key);
}
