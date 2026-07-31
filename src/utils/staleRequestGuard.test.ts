import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequestGuard } from './staleRequestGuard.ts';

test('createRequestGuard: a token is current until a newer one is issued', () => {
  const guard = createRequestGuard();
  const first = guard.next();
  assert.equal(guard.isCurrent(first), true);
});

test('createRequestGuard: an older token stops being current once a newer request starts', () => {
  const guard = createRequestGuard();
  const first = guard.next();
  const second = guard.next();
  assert.equal(guard.isCurrent(first), false);
  assert.equal(guard.isCurrent(second), true);
});

test('createRequestGuard: invalidate() without a new request makes every prior token stale', () => {
  const guard = createRequestGuard();
  const first = guard.next();
  guard.invalidate();
  assert.equal(guard.isCurrent(first), false);
});

test('createRequestGuard: simulates an out-of-order async response — the slow first request never wins', async () => {
  const guard = createRequestGuard();
  const results = [];

  async function search(delayMs, label, token) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    if (guard.isCurrent(token)) results.push(label);
  }

  const slowToken = guard.next();
  const slow = search(30, 'slow-stale', slowToken);
  const fastToken = guard.next();
  const fast = search(5, 'fast-current', fastToken);

  await Promise.all([slow, fast]);
  assert.deepEqual(results, ['fast-current']);
});
