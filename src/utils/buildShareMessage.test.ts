import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildShareMessage, activityDeepLink } from './buildShareMessage.ts';

function shareable(overrides) {
  return {
    id: 'activity-1',
    title: 'Morning stroller walk',
    category: 'stroller_walk',
    startsAt: new Date(2026, 6, 31, 10, 0),
    locationName: 'HaYarkon Park',
    durationMinutes: 60,
    babyMinAgeMonths: null,
    babyMaxAgeMonths: null,
    ...overrides,
  };
}

test('buildShareMessage: warm natural sentence, no emoji', () => {
  const message = buildShareMessage(shareable({}));
  assert.match(message, /^Join us for a stroller walk/);
  assert.match(message, /HaYarkon Park/);
  assert.match(message, /See the activity on Momzi\./);
  assert.doesNotMatch(message, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u); // no emoji range chars
});

test('buildShareMessage: includes the deep link on its own line', () => {
  const message = buildShareMessage(shareable({}));
  assert.ok(message.includes(activityDeepLink('activity-1')));
});

test('buildShareMessage: cancelled activities are never invited to as live', () => {
  const message = buildShareMessage(shareable({ status: 'cancelled' }));
  assert.match(message, /cancelled/i);
  assert.doesNotMatch(message, /Join us/);
});

test('buildShareMessage: missing location name does not break the sentence', () => {
  const message = buildShareMessage(shareable({ locationName: '' }));
  assert.doesNotMatch(message, / in \./);
  assert.match(message, /^Join us for a stroller walk/);
});

test('buildShareMessage: unrecognized category falls back to "other" rather than crashing', () => {
  const message = buildShareMessage(shareable({ category: 'some_future_category' }));
  assert.match(message, /^Join us for a other/);
});
