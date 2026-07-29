import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { completeOnboardingCore } from './completeOnboarding.ts';

/** Integration harness for the exact production onboarding-completion
 *  logic — not a mock, not a reimplementation. Runs completeOnboardingCore
 *  (the same function useAuth.tsx's completeOnboarding wraps) against the
 *  real Supabase project, through the real anon-key client and real RLS
 *  policies, the same way the app does. Each test creates and cleans up
 *  its own throwaway auth user. Requires network access to the project;
 *  skips cleanly if .env / credentials aren't available (e.g. CI without
 *  secrets) rather than failing the whole suite. */

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function loadEnv(): Record<string, string> {
  try {
    const raw = readFileSync(path.join(projectRoot, '.env'), 'utf8');
    const env: Record<string, string> = {};
    for (const line of raw.split('\n')) {
      const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (match) env[match[1]] = match[2].trim();
    }
    return env;
  } catch {
    return {};
  }
}

const env = loadEnv();
const SUPABASE_URL = env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

const canRun = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
if (!canRun) {
  test('completeOnboardingCore integration harness (skipped — no .env credentials)', () => {});
}

/** Creates a throwaway user via the real signUp() endpoint (email
 *  confirmation is disabled project-wide, so this returns a session
 *  immediately with no email sent — safe to call repeatedly, unlike the
 *  confirmation-email path that previously hit over_email_send_rate_limit). */
async function makeTestUser(label: string) {
  const client = createClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const email = `onboarding-harness-${label}-${Math.random().toString(36).slice(2)}@example.com`;
  const { data, error } = await client.auth.signUp({ email, password: 'Harness-Test-Pw-1' });
  if (error || !data.user || !data.session) {
    throw new Error(`test setup: signUp failed for ${label}: ${error?.message ?? 'no session returned'}`);
  }
  return { client, userId: data.user.id, email };
}

/** Cleanup via the real delete-account edge function, authenticated as the
 *  test user's own session — the same path deleteAccount() in useAuth.tsx
 *  uses, and the only account-deletion mechanism available without a
 *  service-role key. Cascades to profiles/children. Best-effort: cleanup
 *  failing must not fail a test that already asserted its behavior. */
async function cleanupTestUser(client: ReturnType<typeof createClient>) {
  try {
    await client.functions.invoke('delete-account', { method: 'POST' });
  } catch {
    // best-effort
  }
}

if (canRun) {
  test('fresh user, one child: succeeds and sets onboarding_completed', async () => {
    const { client, userId } = await makeTestUser('single-child');
    try {
      const events: string[] = [];
      const result = await completeOnboardingCore(
        client,
        userId,
        { children: [{ name: 'Test Child', birthdate: '2024-01-01' }], displayName: 'Harness Parent' },
        (msg) => events.push(msg),
      );
      assert.equal(result.status, 'completed');
      assert.ok(events.includes('[ONBOARDING 01] submit started'));
      assert.ok(events.includes('[ONBOARDING 05] completion flag saved'));

      const { data: profile } = await client.from('profiles').select('onboarding_completed').eq('id', userId).single();
      assert.equal(profile?.onboarding_completed, true);
      const { data: children } = await client.from('children').select('id').eq('profile_id', userId);
      assert.equal(children?.length, 1);
    } finally {
      await cleanupTestUser(client);
    }
  });

  test('fresh user, multiple children: all inserted, first is default', async () => {
    const { client, userId } = await makeTestUser('multi-child');
    try {
      const result = await completeOnboardingCore(client, userId, {
        children: [
          { name: 'First', birthdate: '2022-01-01' },
          { name: 'Second', birthdate: '2024-06-01' },
        ],
      });
      assert.equal(result.status, 'completed');
      const { data: children } = await client
        .from('children')
        .select('name, is_default')
        .eq('profile_id', userId)
        .order('name');
      assert.equal(children?.length, 2);
      assert.equal(children?.find((c) => c.name === 'First')?.is_default, true);
      assert.equal(children?.find((c) => c.name === 'Second')?.is_default, false);
    } finally {
      await cleanupTestUser(client);
    }
  });

  test('zero children: fails, does not flip onboarding_completed', async () => {
    const { client, userId } = await makeTestUser('zero-child');
    try {
      const result = await completeOnboardingCore(client, userId, { children: [] });
      assert.equal(result.status, 'error');
      const { data: profile } = await client.from('profiles').select('onboarding_completed').eq('id', userId).single();
      assert.equal(profile?.onboarding_completed, false);
    } finally {
      await cleanupTestUser(client);
    }
  });

  test('retry after success is idempotent: no duplicate children, no re-write', async () => {
    const { client, userId } = await makeTestUser('retry-success');
    try {
      const first = await completeOnboardingCore(client, userId, { children: [{ name: 'Kid', birthdate: '2023-01-01' }] });
      assert.equal(first.status, 'completed');
      const second = await completeOnboardingCore(client, userId, { children: [{ name: 'Kid', birthdate: '2023-01-01' }] });
      assert.equal(second.status, 'already-complete');
      const { data: children } = await client.from('children').select('id').eq('profile_id', userId);
      assert.equal(children?.length, 1);
    } finally {
      await cleanupTestUser(client);
    }
  });

  test('double-submit (concurrent) does not create duplicate children', async () => {
    const { client, userId } = await makeTestUser('concurrent');
    try {
      const input = { children: [{ name: 'Racer', birthdate: '2023-05-05' }] };
      const [a, b] = await Promise.all([
        completeOnboardingCore(client, userId, input),
        completeOnboardingCore(client, userId, input),
      ]);
      // Either both observe each other cleanly (completed/already-complete),
      // or the database's children_one_default_per_profile unique index
      // catches a genuine race and one call surfaces a recoverable error —
      // both are acceptable outcomes. What must never happen is a
      // duplicate child or an uncaught exception (both calls resolved to
      // a defined status at all).
      assert.ok([a.status, b.status].every((s) => s === 'completed' || s === 'already-complete' || s === 'error'));
      const { data: children } = await client.from('children').select('id').eq('profile_id', userId);
      assert.equal(children?.length, 1);
    } finally {
      await cleanupTestUser(client);
    }
  });

  test('resume: child already inserted by a prior partial attempt, completion still succeeds', async () => {
    const { client, userId } = await makeTestUser('resume');
    try {
      // Simulate a prior attempt that got as far as inserting the child but
      // never reached the completion-flag write (e.g. app was killed mid-call).
      const { error: preInsertError } = await client
        .from('children')
        .insert({ profile_id: userId, name: 'Already Saved', birthdate: '2022-03-03', is_default: true });
      assert.equal(preInsertError, null);

      // Re-opening the app and completing again — no new children provided,
      // since the form would resume with the existing child already loaded.
      const result = await completeOnboardingCore(client, userId, { children: [] });
      assert.equal(result.status, 'completed');
      const { data: children } = await client.from('children').select('id').eq('profile_id', userId);
      assert.equal(children?.length, 1);
    } finally {
      await cleanupTestUser(client);
    }
  });

  test('partially-completed profile field save with no children yet leaves onboarding_completed false and is safely retryable', async () => {
    const { client, userId } = await makeTestUser('partial-profile');
    try {
      const first = await completeOnboardingCore(client, userId, { children: [], phone: '+15551234567' });
      assert.equal(first.status, 'error'); // no children — expected to fail at that stage
      const { data: profile } = await client.from('profiles').select('onboarding_completed, phone').eq('id', userId).single();
      assert.equal(profile?.onboarding_completed, false);
      assert.equal(profile?.phone, '+15551234567'); // profile fields already saved from the failed attempt

      // Retry with the child now supplied — must succeed without re-erroring
      // on the phone field or duplicating anything.
      const second = await completeOnboardingCore(client, userId, {
        children: [{ name: 'Late Child', birthdate: '2023-09-09' }],
        phone: '+15551234567',
      });
      assert.equal(second.status, 'completed');
    } finally {
      await cleanupTestUser(client);
    }
  });
}
