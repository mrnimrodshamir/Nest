type Listener = (blockedUserId: string) => void;
type StateListener = (userId: string, blocked: boolean) => void;
const blockedIds = new Set<string>();
const listeners = new Set<Listener>();
const stateListeners = new Set<StateListener>();

export function markUserBlocked(userId: string) {
  blockedIds.add(userId);
  for (const listener of listeners) listener(userId);
  for (const listener of stateListeners) listener(userId, true);
}

export function markUserUnblocked(userId: string) {
  blockedIds.delete(userId);
  for (const listener of stateListeners) listener(userId, false);
}

export function isUserLocallyBlocked(userId: string): boolean {
  return blockedIds.has(userId);
}

export function subscribeToBlocks(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Block and unblock notifications for consumers that must refetch durable
 * server state. Existing block-only subscribers intentionally keep their
 * immediate removal semantics. */
export function subscribeToBlockStateChanges(listener: StateListener): () => void {
  stateListeners.add(listener);
  return () => stateListeners.delete(listener);
}
