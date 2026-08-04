import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveActivityFormMode, startTimeValidationMessage } from './activityFormMode.ts';

test('create mode is a new-activity flow with Review and normal child auto-selection', () => {
  assert.deepEqual(resolveActivityFormMode('create'), {
    showsReview: true,
    autoSelectsCurrentDefaultChild: true,
    requiresExplicitStartTime: false,
    createsNewActivity: true,
  });
});

test('edit mode preserves direct-save behavior and never creates a duplicate', () => {
  assert.deepEqual(resolveActivityFormMode('edit'), {
    showsReview: false,
    autoSelectsCurrentDefaultChild: false,
    requiresExplicitStartTime: false,
    createsNewActivity: false,
  });
});

test('again mode creates through Review and requires a newly selected date', () => {
  assert.deepEqual(resolveActivityFormMode('again'), {
    showsReview: true,
    autoSelectsCurrentDefaultChild: true,
    requiresExplicitStartTime: true,
    createsNewActivity: true,
  });
  assert.equal(startTimeValidationMessage('again', false), 'Choose a new date and time');
  assert.equal(startTimeValidationMessage('again', true), null);
});

test('create and edit do not require an extra date selection', () => {
  assert.equal(startTimeValidationMessage('create', false), null);
  assert.equal(startTimeValidationMessage('edit', false), null);
});
