import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/** Source-inspection regression guard: the real production bug was a
 *  password-reset email linking to `localhost:3000`. useAuth.tsx itself
 *  can't be imported directly in this test runner (it pulls in
 *  expo-apple-authentication and other native modules), so this asserts
 *  directly against the file text — cheap, and it fails loudly the moment
 *  anyone reintroduces a localhost/dev URL into the production redirect. */
const source = readFileSync(fileURLToPath(new URL('./useAuth.tsx', import.meta.url)), 'utf8');

test('the password-reset redirect is the production custom-scheme deep link, not a dev/localhost URL', () => {
  assert.match(source, /redirectTo:\s*'nestup:\/\/reset-password'/);
});

test('no localhost/dev URL appears anywhere in useAuth.tsx', () => {
  assert.doesNotMatch(source, /localhost/i);
  assert.doesNotMatch(source, /127\.0\.0\.1/);
});

test('resetPasswordForEmail is called with the normalized email and no other side channel', () => {
  assert.match(source, /supabase\.auth\.resetPasswordForEmail\(normalizeEmail\(email\), \{/);
});

test('Apple sign-in uses a native token exchange, not a redirectTo/URL-based flow — unaffected by the recovery redirect fix', () => {
  assert.match(source, /AppleAuthentication\.signInAsync/);
  assert.match(source, /signInWithIdToken/);
  // The Apple sign-in function body must not itself reference redirectTo —
  // that option only ever appears on the unrelated resetPasswordForEmail call.
  const appleFnMatch = source.match(/const signInWithApple = useCallback\(async \(\) => \{[\s\S]*?\n  \}, \[[^\]]*\]\);/);
  assert.ok(appleFnMatch, 'signInWithApple implementation not found');
  assert.doesNotMatch(appleFnMatch[0], /redirectTo/);
});
