import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRecoveryUrl } from './parseRecoveryUrl.ts';

test('a valid recovery link yields the access and refresh tokens', () => {
  const result = parseRecoveryUrl('nestup://reset-password#access_token=abc123&refresh_token=xyz789&type=recovery');
  assert.deepEqual(result, { status: 'ok', accessToken: 'abc123', refreshToken: 'xyz789' });
});

test('the momzi:// scheme is accepted the same way', () => {
  const result = parseRecoveryUrl('momzi://reset-password#access_token=abc123&refresh_token=xyz789&type=recovery');
  assert.equal(result.status, 'ok');
});

test('an expired/used link (otp_expired) is reported as expired, not malformed', () => {
  const result = parseRecoveryUrl('nestup://reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
  assert.deepEqual(result, { status: 'expired' });
});

test('a reused link surfaced as access_denied is also treated as expired', () => {
  const result = parseRecoveryUrl('nestup://reset-password#error=access_denied&error_code=access_denied');
  assert.deepEqual(result, { status: 'expired' });
});

test('an unrecognized error code is treated as malformed, not silently accepted', () => {
  const result = parseRecoveryUrl('nestup://reset-password#error=server_error&error_code=unexpected_failure');
  assert.deepEqual(result, { status: 'malformed' });
});

test('a link missing the refresh token is malformed', () => {
  const result = parseRecoveryUrl('nestup://reset-password#access_token=abc123&type=recovery');
  assert.deepEqual(result, { status: 'malformed' });
});

test('a link missing the access token is malformed', () => {
  const result = parseRecoveryUrl('nestup://reset-password#refresh_token=xyz789&type=recovery');
  assert.deepEqual(result, { status: 'malformed' });
});

test('an unparseable URL string is malformed, never throws', () => {
  assert.deepEqual(parseRecoveryUrl('not a url at all'), { status: 'malformed' });
});

test('a well-formed URL that is not the reset-password route is not_recovery — other deep links (shared content, etc.) are untouched', () => {
  assert.deepEqual(parseRecoveryUrl('nestup://activity/abc-123'), { status: 'not_recovery' });
});

test('tokens are accepted from the query string too, not just the fragment', () => {
  const result = parseRecoveryUrl('nestup://reset-password?access_token=abc123&refresh_token=xyz789&type=recovery');
  assert.deepEqual(result, { status: 'ok', accessToken: 'abc123', refreshToken: 'xyz789' });
});

test('an explicit non-recovery type is rejected even with valid-looking tokens', () => {
  const result = parseRecoveryUrl('nestup://reset-password#access_token=abc123&refresh_token=xyz789&type=signup');
  assert.deepEqual(result, { status: 'not_recovery' });
});
