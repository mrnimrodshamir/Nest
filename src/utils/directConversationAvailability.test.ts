import assert from 'node:assert/strict';
import test from 'node:test';
import { resolveUnavailableDirectChatIds } from './directConversationAvailability.ts';

const chats = [
  { id: 'ab', type: 'direct' },
  { id: 'ac', type: 'direct' },
  { id: 'group', type: 'group' },
];
const participants = [
  { chat_id: 'ab', user_id: 'a' }, { chat_id: 'ab', user_id: 'b' },
  { chat_id: 'ac', user_id: 'a' }, { chat_id: 'ac', user_id: 'c' },
  { chat_id: 'group', user_id: 'a' }, { chat_id: 'group', user_id: 'b' },
];

async function resolve(options: {
  persisted?: string[];
  local?: string[];
  blockedBetween?: (id: string) => boolean;
} = {}) {
  return resolveUnavailableDirectChatIds({
    userId: 'a',
    chats,
    participants,
    persistedBlockedUserIds: new Set(options.persisted ?? []),
    locallyBlockedUserIds: new Set(options.local ?? []),
    isBlockedBetween: async (id) => options.blockedBetween?.(id) ?? false,
  });
}

test('an own persisted block hides the direct chat after remount, cold restart, auth restore, and refetch', async () => {
  for (const phase of ['remount', 'cold restart', 'auth restore', 'refetch']) {
    const unavailable = await resolve({ persisted: ['b'] });
    assert.equal(unavailable.has('ab'), true, phase);
    assert.equal(unavailable.has('ac'), false, phase);
  }
});

test('an inverse block hides the direct chat without revealing block direction', async () => {
  const checked: string[] = [];
  const unavailable = await resolve({
    blockedBetween: (id) => {
      checked.push(id);
      return id === 'b';
    },
  });
  assert.equal(unavailable.has('ab'), true);
  assert.deepEqual(checked.sort(), ['b', 'c']);
});

test('an immediate local block wins even before persisted state refreshes', async () => {
  const checked: string[] = [];
  const unavailable = await resolve({ local: ['b'], blockedBetween: (id) => { checked.push(id); return false; } });
  assert.equal(unavailable.has('ab'), true);
  assert.deepEqual(checked, ['c']);
});

test('unblock restores only backend-eligible direct chats', async () => {
  const available = await resolve();
  assert.equal(available.has('ab'), false);

  const stillUnavailable = await resolve({ blockedBetween: (id) => id === 'b' });
  assert.equal(stillUnavailable.has('ab'), true);
});

test('unrelated direct chats and all group chats are unaffected', async () => {
  const unavailable = await resolve({ persisted: ['b'] });
  assert.equal(unavailable.has('ac'), false);
  assert.equal(unavailable.has('group'), false);
});

test('malformed direct chats fail closed and availability errors prevent publishing a partial list', async () => {
  const orphaned = await resolveUnavailableDirectChatIds({
    userId: 'a',
    chats: [{ id: 'orphan', type: 'direct' }],
    participants: [{ chat_id: 'orphan', user_id: 'a' }],
    persistedBlockedUserIds: new Set(),
    isBlockedBetween: async () => false,
  });
  assert.equal(orphaned.has('orphan'), true);

  await assert.rejects(() => resolve({ blockedBetween: () => { throw new Error('network unavailable'); } }));
});
