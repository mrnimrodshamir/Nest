type Listener = (blockedUserId: string) => void;
const blockedIds = new Set<string>();
const listeners = new Set<Listener>();

export function markUserBlocked(userId: string) {
  blockedIds.add(userId);
  for (const listener of listeners) listener(userId);
}

export function markUserUnblocked(userId: string) {
  blockedIds.delete(userId);
}

export function isUserLocallyBlocked(userId: string): boolean {
  return blockedIds.has(userId);
}

export function subscribeToBlocks(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
