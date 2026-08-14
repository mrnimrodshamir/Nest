import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createAnalytics, sanitizeAnalyticsProperties, type AnalyticsPayload } from './analyticsCore.ts';

test('analytics strips private and malformed properties', () => {
  assert.deepEqual(sanitizeAnalyticsProperties({
    content_type: 'event',
    language: 'he',
    email: 'parent@example.com',
    child_birthdate: '2025-01-01',
    precise_coordinates: '32.1,34.8',
    message_content: 'private',
    count: 3,
    invalid_number: Number.NaN,
  }), { content_type: 'event', language: 'he', count: 3 });
});

test('analytics truncates strings and caps property count', () => {
  const input = Object.fromEntries(Array.from({ length: 25 }, (_, index) => [`value_${index}`, 'x'.repeat(200)]));
  const result = sanitizeAnalyticsProperties(input);
  assert.equal(Object.keys(result).length, 20);
  assert.equal(String(result.value_0).length, 120);
});

test('track, identify and screen use one vendor-neutral transport', async () => {
  const seen: AnalyticsPayload[] = [];
  const client = createAnalytics({ send: async (payload) => { seen.push(payload); } });
  client.track('event_opened', { content_id: 'event-1' });
  client.identify({ language: 'fr' });
  client.screen('Discovery', { discovery_mode: 'mixed' });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(seen.map((item) => item.eventName), ['event_opened', 'user_identified', 'screen_viewed']);
  assert.equal(seen[2].properties.screen_name, 'Discovery');
});

test('transport failures never become unhandled product failures', async () => {
  const client = createAnalytics({ send: async () => { throw new Error('offline'); } });
  assert.doesNotThrow(() => client.track('share_failed', { share_channel: 'native' }));
  await new Promise((resolve) => setTimeout(resolve, 0));
});
