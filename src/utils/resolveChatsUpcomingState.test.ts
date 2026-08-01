import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveChatsUpcomingState } from './resolveChatsUpcomingState.ts';

test('resolveChatsUpcomingState: no upcoming, no past -> empty-no-past', () => {
  assert.equal(resolveChatsUpcomingState(0, 0), 'empty-no-past');
});

test('resolveChatsUpcomingState: no upcoming, existing past -> empty-with-past', () => {
  assert.equal(resolveChatsUpcomingState(0, 3), 'empty-with-past');
});

test('resolveChatsUpcomingState: upcoming exists -> has-upcoming, regardless of past count', () => {
  assert.equal(resolveChatsUpcomingState(1, 0), 'has-upcoming');
  assert.equal(resolveChatsUpcomingState(2, 5), 'has-upcoming');
});
