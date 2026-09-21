import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { computeRouteDecision } from './routing.ts';

const appleSession = (email = 'parent@privaterelay.appleid.com') => ({
  user: { id: 'apple-user', email, app_metadata: { provider: 'apple', providers: ['apple'] } },
});

const completeProfile = {
  onboardingCompleted: true,
  displayName: 'Dana Parent',
  parentRole: 'parent' as const,
  birthdate: '1990-05-12',
  neighborhood: 'Florentin',
};

test('new Apple users cannot reach Main before profile completion', () => {
  assert.equal(computeRouteDecision(appleSession(), null), 'complete-profile');
  assert.equal(computeRouteDecision(appleSession(), { ...completeProfile, onboardingCompleted: false }), 'complete-profile');
});

test('complete Apple users enter Main and Private Relay is not treated as incomplete', () => {
  assert.equal(computeRouteDecision(appleSession(), completeProfile), 'main-navigator');
  assert.equal(computeRouteDecision(appleSession('visible@example.com'), completeProfile), 'main-navigator');
});

test('legacy/default Apple display names and missing required MVP fields stay gated', () => {
  assert.equal(computeRouteDecision(appleSession(), { ...completeProfile, displayName: 'Momzy member' }), 'complete-profile');
  assert.equal(computeRouteDecision(appleSession(), { ...completeProfile, parentRole: null }), 'complete-profile');
  assert.equal(computeRouteDecision(appleSession(), { ...completeProfile, neighborhood: null }), 'complete-profile');
});

/** App Review 5.1.1(v): a caregiver's own date of birth is not relevant to
 *  core functionality, so it must never gate access. An Apple account with
 *  no birthdate reaches Main like any other complete account. */
test('a missing caregiver birthdate never gates an Apple account', () => {
  assert.equal(computeRouteDecision(appleSession(), { ...completeProfile, birthdate: null }), 'main-navigator');
  assert.equal(computeRouteDecision(appleSession(), { ...completeProfile, birthdate: undefined }), 'main-navigator');
});

test('Apple completion uses the existing onboarding path and repairs legacy-complete rows', async () => {
  const auth = await readFile(new URL('../hooks/useAuth.tsx', import.meta.url), 'utf8');
  const screen = await readFile(new URL('../screens/auth/CompleteAppleProfileScreen.tsx', import.meta.url), 'utf8');
  assert.match(auth, /repairCompletedProfile: true/);
  assert.match(auth, /needsAppleProfileSetup/);
  assert.match(screen, /FamilyProfileFields/);
  assert.match(screen, /OnboardingChildrenEditor/);
  assert.match(screen, /useChildren\(session\?\.user\.id/);
});
