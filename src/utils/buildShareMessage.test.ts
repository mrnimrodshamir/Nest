import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildShareMessage, activityDeepLink } from './buildShareMessage.ts';
import { APP_NAME } from '../constants/brand.ts';

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
  assert.match(message, /^Join us at HaYarkon Park/);
  assert.match(message, /HaYarkon Park/);
  assert.match(message, new RegExp(`Open in ${APP_NAME}:`));
  assert.doesNotMatch(message, /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u); // no emoji range chars
});

test('buildShareMessage: includes the deep link on its own line', () => {
  const message = buildShareMessage(shareable({}));
  assert.ok(message.includes(activityDeepLink('activity-1')));
});

test('brand and deep links use the NestUp identity', () => {
  assert.equal(APP_NAME, 'NestUp');
  assert.equal(activityDeepLink('activity-1'), 'nestup://activity/activity-1');
});

test('buildShareMessage: cancelled activities are never invited to as live', () => {
  const message = buildShareMessage(shareable({ status: 'cancelled' }));
  assert.match(message, /cancelled/i);
  assert.doesNotMatch(message, /Join us/);
});

test('buildShareMessage: missing location name does not break the sentence', () => {
  const message = buildShareMessage(shareable({ locationName: '' }));
  assert.doesNotMatch(message, / in \./);
  assert.match(message, /^Join us for Morning stroller walk/);
});

test('buildShareMessage: an unknown category cannot leak placeholder copy', () => {
  const message = buildShareMessage(shareable({ category: 'some_future_category' }));
  assert.match(message, /^Join us at HaYarkon Park/);
  assert.doesNotMatch(message, /some_future_category|a other/);
});

test('buildShareMessage: cancellation message references the app by the shared brand constant', () => {
  const message = buildShareMessage(shareable({ status: 'cancelled' }));
  assert.match(message, new RegExp(`Open in ${APP_NAME}:`));
});

test('generic meeting-point data is never exposed in share copy', () => {
  const message = buildShareMessage(shareable({ locationName: 'Selected meeting point' }));
  assert.doesNotMatch(message, /selected meeting point/i);
  assert.match(message, /^Join us for Morning stroller walk/);
});
