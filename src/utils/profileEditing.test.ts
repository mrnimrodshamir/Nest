import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { formatAppVersion } from './appVersion.ts';
import { parentAgeYears } from './parentAge.ts';

const read = (p: string) => readFileSync(new URL(p, import.meta.url), 'utf8');
const editProfile = read('../screens/EditProfileScreen.tsx');
const auth = read('../hooks/useAuth.tsx');
const field = read('../components/ParentBirthdateField.tsx');
const profileScreen = read('../screens/ProfileScreen.tsx');

// ===========================================================================
// PARENT ROLE PERSISTENCE
// ===========================================================================

test('REGRESSION: the form is seeded once per account, not on every profile refetch', () => {
  // The bug: useAuth refetches the profile on every Supabase auth event
  // (TOKEN_REFRESHED fires on its own schedule and on app foreground), which
  // produced a NEW profile object. An effect keyed on `profile` then wiped the
  // user's unsaved role selection back to the stored null, and Save persisted
  // that null. Keying on the account id makes a background refresh harmless.
  assert.match(editProfile, /seededForRef/);
  assert.match(editProfile, /seededForRef\.current === profile\.id/);
  assert.match(editProfile, /seededForRef\.current = profile\.id/);
});

test('REGRESSION: no effect assigns form state straight from a bare profile check', () => {
  // `if (profile) { setParentRole(...) }` inside a [profile] effect is exactly
  // the shape that caused the data loss.
  assert.ok(
    !/useEffect\(\(\) => \{\s*if \(profile\) \{\s*setDisplayName/.test(editProfile),
    'the unguarded re-seeding effect is back',
  );
});

test('the selected role is included in the save payload', () => {
  assert.match(editProfile, /updateProfileDetails\(\{[\s\S]{0,240}parentRole,/);
});

test('all three roles are offered and each is un-choosable', () => {
  assert.match(editProfile, /\['mom', 'dad', 'parent'\]/);
  assert.match(editProfile, /setParentRole\(selected \? null : option\)/);
});

test('the write only happens when the caller owns the field', () => {
  // A screen that does not render the role picker must not blank a stored one.
  assert.match(auth, /details\.parentRole !== undefined \? \{ parent_role: details\.parentRole \} : \{\}/);
});

test('the profile is refetched after a successful save, so Profile stops showing the old role', () => {
  assert.match(auth, /\.eq\('id', session\.user\.id\);[\s\S]{0,300}await loadProfile\(session\.user\.id\)/);
});

test('parent_role is read back, so a reopened form shows the stored choice', () => {
  assert.match(auth, /\.select\('id, display_name[^']*parent_role/);
  assert.match(auth, /parentRole: coerceParentRole\(row\.parent_role\)/);
});

// ===========================================================================
// PARENT DATE OF BIRTH
// ===========================================================================

test('birthdate is saved to profiles.birthdate and nowhere else', () => {
  assert.match(auth, /birthdate: hasDisplayableAge\(details\.birthdate\) \? details\.birthdate : null/);
  assert.match(editProfile, /birthdate: parentBirthdate/);
});

test('an omitted birthdate leaves the stored value untouched', () => {
  assert.match(auth, /details\.birthdate !== undefined/);
});

test('IMPOSSIBLE DATES are rejected before they reach the column age_years derives from', () => {
  const now = new Date('2026-08-10T00:00:00Z');
  assert.equal(parentAgeYears('2030-01-01', now), null, 'future');
  assert.equal(parentAgeYears('2020-01-01', now), null, 'too young');
  assert.equal(parentAgeYears('1850-01-01', now), null, 'too old');
  assert.equal(parentAgeYears('not-a-date', now), null, 'malformed');
  assert.equal(parentAgeYears('1999-01-01', now), 27, 'a real date still works');
});

test('the picker cannot even produce an out-of-range date', () => {
  assert.match(field, /const MIN_AGE = 13/);
  assert.match(field, /const MAX_AGE = 120/);
  assert.match(field, /maximumDate=\{maximumDate\}/);
  assert.match(field, /minimumDate=\{minimumDate\}/);
});

test('the field is optional and clearable', () => {
  assert.match(field, /common\.optional/);
  assert.match(field, /onChange\(null\)/);
});

test('PRIVACY: the birthdate never leaves the private profile row', () => {
  // Reading it from `profiles` is fine - RLS scopes that to the caller's own
  // row. The public view must expose only the derived age.
  const publicProfile = read('../hooks/usePublicProfile.ts');
  assert.match(publicProfile, /age_years/);
  const code = publicProfile.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/\bbirthdate\b/.test(code), 'birthdate is selected for a public profile');
});

test('the birthdate field is localized, with no hardcoded copy', () => {
  for (const key of ['profile.birthdate.label', 'profile.birthdate.hint', 'profile.birthdate.shows']) {
    assert.match(field, new RegExp(key.replace(/\./g, '\\.')), `${key} is not used`);
  }
  assert.ok(!/'Date of birth'|'Optional'/.test(field), 'English copy is hardcoded');
});

test('SMALL IPHONE: the label row wraps rather than clipping a longer Hebrew label', () => {
  assert.match(field, /flexWrap: 'wrap'/);
  assert.match(field, /minHeight: 48/);
});

// ===========================================================================
// VERSION / BUILD LINE
// ===========================================================================

test('the version line reads runtime metadata, never a hardcoded build number', () => {
  assert.match(profileScreen, /Application\.nativeApplicationVersion/);
  assert.match(profileScreen, /Application\.nativeBuildVersion/);
  // EAS assigns the build number remotely, so it exists in no file here.
  assert.ok(!/\(30\)|'30'/.test(profileScreen), 'a build number is hardcoded');
});

test('it renders as NestUp 0.1.0 (30)', () => {
  assert.equal(formatAppVersion('NestUp', '0.1.0', '30'), 'NestUp 0.1.0 (30)');
});

test('a missing build number degrades instead of printing "(null)"', () => {
  assert.equal(formatAppVersion('NestUp', '0.1.0', null), 'NestUp 0.1.0');
  assert.equal(formatAppVersion('NestUp', null, '30'), null);
});

test('the line is rendered only when there is something to show', () => {
  assert.match(profileScreen, /\{versionLine &&/);
  assert.match(profileScreen, /versionLine: \{[\s\S]{0,160}color: theme\.text\.muted/);
});
