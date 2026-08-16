import assert from 'node:assert/strict';
import test from 'node:test';
import { profileCompleteness } from './profileCompleteness.ts';

const base = {
  onboardingCompleted: true,
  displayName: 'Nimrod',
  parentRole: null,
  birthdate: null,
  neighborhood: null,
  occupation: null,
  bio: null,
  avatarUrl: null,
};

test('new or interrupted accounts require initial setup', () => {
  assert.equal(profileCompleteness(null), 'requires-initial-setup');
  assert.equal(profileCompleteness({ ...base, onboardingCompleted: false }), 'requires-initial-setup');
});

test('legacy product-name placeholders are incomplete even when the old flag is true', () => {
  for (const displayName of ['Momzi member', 'MOMZY MEMBER', ' NestUp   member ']) {
    assert.equal(profileCompleteness({ ...base, displayName }), 'requires-initial-setup');
  }
});

test('established accounts are never locked out for optional gaps', () => {
  assert.equal(profileCompleteness(base), 'established-with-optional-gaps');
});

test('complete rich profiles are distinguished centrally', () => {
  assert.equal(profileCompleteness({
    ...base,
    parentRole: 'parent',
    birthdate: '1990-01-01',
    neighborhood: 'Florentin',
    occupation: 'Designer',
    bio: 'Parent of two.',
    avatarUrl: 'https://example.com/avatar.jpg',
  }), 'complete');
});
