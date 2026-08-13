import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const publicHook = read('../hooks/usePublicProfile.ts');
const publicScreen = read('../screens/PublicProfileScreen.tsx');
const auth = read('../hooks/useAuth.tsx');
const onboarding = read('../lib/completeOnboarding.ts');
const emailSignup = read('../screens/auth/SignUpScreen.tsx');
const appleSignup = read('../screens/auth/CompleteAppleProfileScreen.tsx');
const activityDetails = read('../screens/ActivityDetailScreen.tsx');
const eventDetails = read('../screens/EventDetailsScreen.tsx');
const eventAttendees = read('../components/EventAttendeesSheet.tsx');

test('public profile query exposes rich family data without private fields', () => {
  for (const field of ['child_names', 'child_ages_months', 'age_years', 'parent_role', 'occupation', 'bio']) {
    assert.match(publicHook, new RegExp(field));
  }
  const executable = publicHook.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  for (const privateField of ['birthdate', 'email', 'phone']) {
    assert.ok(!new RegExp(`\\b${privateField}\\b`).test(executable), `${privateField} reached the public query`);
  }
});

test('public profile renders every child and hides absent optional sections', () => {
  assert.match(publicScreen, /buildPublicChildren\(profile\.childNames, profile\.childAgesMonths\)/);
  assert.match(publicScreen, /profile\.occupation\?\.trim\(\) \?/);
  assert.match(publicScreen, /profile\.bio\?\.trim\(\) \?/);
  assert.ok(!/Not provided|Unknown age/.test(publicScreen));
});

test('email and Apple onboarding share one family profile field component', () => {
  assert.match(emailSignup, /<FamilyProfileFields/);
  assert.match(appleSignup, /<FamilyProfileFields/);
  assert.match(emailSignup, /<AvatarPicker/);
  assert.match(appleSignup, /<AvatarPicker/);
});

test('onboarding persists only self-selected role and private parent birthdate', () => {
  assert.match(onboarding, /profileUpdate\.parent_role = input\.parentRole/);
  assert.match(onboarding, /profileUpdate\.birthdate = input\.birthdate/);
  assert.match(auth, /hasDisplayableAge\(input\.birthdate\)/);
});

test('established users remain gated only by the existing onboarding flag', () => {
  const routing = read('../lib/routing.ts');
  const completeness = read('./profileCompleteness.ts');
  assert.match(routing, /needsInitialProfileSetup/);
  assert.match(completeness, /if \(!profile \|\| !profile\.onboardingCompleted\)/);
  assert.match(completeness, /established-with-optional-gaps/);
});

test('activity participants and event attendees both open Public Profile', () => {
  assert.match(activityDetails, /onOpenPerson\(person\.userId\)/);
  assert.match(eventDetails, /<EventAttendeesSheet/);
  assert.match(eventAttendees, /onOpenProfile\(attendee\.userId\)/);
});
