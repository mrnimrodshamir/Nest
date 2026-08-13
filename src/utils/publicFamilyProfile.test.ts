import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPublicChildren, normalizeProfileBio, PROFILE_BIO_MAX_LENGTH } from './publicFamilyProfile.ts';

test('public children include every named child and coarse ages only', () => {
  assert.deepEqual(buildPublicChildren(['Go', 'Yo', 'Bo'], [8, 24, 41]), [
    { name: 'Go', ageMonths: 8, ageKey: 'profile.childAge.month.other', ageCount: 8 },
    { name: 'Yo', ageMonths: 24, ageKey: 'profile.childAge.year.other', ageCount: 2 },
    { name: 'Bo', ageMonths: 41, ageKey: 'profile.childAge.year.other', ageCount: 3 },
  ]);
});

test('newborn, singular month and missing age are represented safely', () => {
  assert.deepEqual(buildPublicChildren(['New', 'One', 'Unknown'], [0, 1, null]), [
    { name: 'New', ageMonths: 0, ageKey: 'profile.childAge.newborn', ageCount: 0 },
    { name: 'One', ageMonths: 1, ageKey: 'profile.childAge.month.one', ageCount: 1 },
    { name: 'Unknown', ageMonths: null, ageKey: null, ageCount: null },
  ]);
});

test('invalid ages and blank names degrade to name-only rows', () => {
  assert.deepEqual(buildPublicChildren([' ', 'Go'], [-1, Number.NaN]), [
    { name: 'Go', ageMonths: null, ageKey: null, ageCount: null },
  ]);
});

test('bio is trimmed, optional, and capped at 300 characters', () => {
  assert.equal(normalizeProfileBio('  Hello  '), 'Hello');
  assert.equal(normalizeProfileBio('   '), null);
  assert.equal(normalizeProfileBio('x'.repeat(350))?.length, PROFILE_BIO_MAX_LENGTH);
});
