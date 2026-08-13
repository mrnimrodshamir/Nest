import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createOccurrenceId, mapDigitelSyncCandidate } from '../../supabase/functions/_shared/digitel/eventMapping.ts';
import type { DigitelEventCandidate } from '../../supabase/functions/_shared/digitel/connector.ts';

const candidate: DigitelEventCandidate = {
  provider: 'tel_aviv_digitel', providerEventId: 'digitel-v1-abcd', providerTransportId: '17', sourceGroupId: 'group',
  title: 'שעת סיפור', description: null, sourceType: 'אירועים', sourceUrl: null,
  startTime: '2026-08-20T15:00:00.000Z', endTime: null, recurring: null, ageMinMonths: null,
  ageMaxMonths: null, category: null, locationName: null, latitude: 32.07, longitude: 34.78,
  price: null, registrationRequired: null, registrationUrl: null, imageUrl: null, iconUrl: null,
  cancellationStatus: null, sourcePublishedAt: null, sourceUpdatedAt: null,
  occurrenceFingerprint: 'digitel-v1-abcd', occurrenceIdentityKey: 'identity',
};

test('sync mapping is deterministic and supplies safe required fallbacks', () => {
  const first = mapDigitelSyncCandidate(candidate);
  const second = mapDigitelSyncCandidate(candidate);
  assert.deepEqual(first, second);
  assert.match(first.occurrenceId, /^event-occ-v1-[0-9a-f]{16}$/);
  assert.equal(first.locationName, 'Tel Aviv-Yafo');
  assert.match(first.sourceUrl, /^https:\/\//);
  assert.equal(first.category, 'story_time');
});

test('occurrence identity changes with start time and never uses transport id alone', () => {
  const one = createOccurrenceId('tel_aviv_digitel', 'fingerprint', '2026-08-20T15:00:00Z');
  const two = createOccurrenceId('tel_aviv_digitel', 'fingerprint', '2026-08-20T16:00:00Z');
  assert.notEqual(one, two);
});

test('provider metadata contains no raw provider payload', () => {
  assert.deepEqual(Object.keys(mapDigitelSyncCandidate(candidate).providerMetadata).sort(), ['icon_url', 'source_group_id', 'source_type']);
});
