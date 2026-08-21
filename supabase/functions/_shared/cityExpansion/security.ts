const secretKey = /(secret|token|password|private[_-]?key|service[_-]?role|authorization)/i;

export function sanitizeArtifact(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeArtifact);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .filter(([key]) => !secretKey.test(key))
    .map(([key, child]) => [key, sanitizeArtifact(child)]));
}

export function artifactContainsSecretField(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(artifactContainsSecretField);
  if (!value || typeof value !== 'object') return false;
  return Object.entries(value as Record<string, unknown>).some(([key, child]) => secretKey.test(key) || artifactContainsSecretField(child));
}

export function assertProductionActionAllowed(input: { action: string; approvalStatus: 'PENDING' | 'APPROVED' | 'REJECTED'; actorType: 'agent' | 'human' }): void {
  if (input.action !== 'production_write') return;
  if (input.approvalStatus !== 'APPROVED' || input.actorType !== 'human') throw new Error('Production action requires explicit human approval');
}
