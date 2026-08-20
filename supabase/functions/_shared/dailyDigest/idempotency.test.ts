import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildDigestSendKey, DIGEST_TYPE_DAILY, DIGEST_TYPE_WEEKLY } from './idempotency.ts';

test('the same user/type/date always builds the same key', () => {
  const a = buildDigestSendKey('user-1', DIGEST_TYPE_DAILY, '2026-08-20');
  const b = buildDigestSendKey('user-1', DIGEST_TYPE_DAILY, '2026-08-20');
  assert.equal(a, b);
});

test('a different user, type, or date builds a different key', () => {
  const base = buildDigestSendKey('user-1', DIGEST_TYPE_DAILY, '2026-08-20');
  assert.notEqual(buildDigestSendKey('user-2', DIGEST_TYPE_DAILY, '2026-08-20'), base);
  assert.notEqual(buildDigestSendKey('user-1', DIGEST_TYPE_WEEKLY, '2026-08-20'), base);
  assert.notEqual(buildDigestSendKey('user-1', DIGEST_TYPE_DAILY, '2026-08-21'), base);
});

test('Weekly retries share one user/type/week key', () => {
  assert.equal(
    buildDigestSendKey('user-1', DIGEST_TYPE_WEEKLY, '2026-08-23'),
    buildDigestSendKey('user-1', DIGEST_TYPE_WEEKLY, '2026-08-23'),
  );
});
