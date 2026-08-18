import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deduplicateDigitelCandidates } from './staging.ts';
import type { DigitelEventCandidate } from './connector.ts';

/** This module had zero test coverage before a real production failure
 *  (duplicate key on events_provider_provider_transport_id_key, 2026-08-18
 *  18:17 UTC) — see staging.ts's module doc on deduplicateDigitelCandidates
 *  for the full root-cause explanation. These tests exist specifically
 *  because that gap is what let the bug reach production undetected. */
function candidate(overrides: Partial<DigitelEventCandidate> = {}): DigitelEventCandidate {
  return {
    provider: 'tel_aviv_digitel',
    providerEventId: 'digitel-v1-aaaa',
    providerTransportId: '12345',
    sourceGroupId: null,
    title: 'שעת סיפור',
    description: null,
    sourceType: null,
    sourceUrl: null,
    startTime: '2026-08-20T10:00:00Z',
    endTime: null,
    recurring: null,
    ageMinMonths: null,
    ageMaxMonths: null,
    category: null,
    locationName: 'ספריית שרמן',
    latitude: 32.05,
    longitude: 34.77,
    price: null,
    registrationRequired: null,
    registrationUrl: null,
    imageUrl: null,
    iconUrl: null,
    cancellationStatus: null,
    sourcePublishedAt: null,
    sourceUpdatedAt: '2026-08-19T08:00:00Z',
    occurrenceFingerprint: 'digitel-v1-aaaa',
    occurrenceIdentityKey: 'k1',
    ...overrides,
  };
}

// ===========================================================================
// THE REAL BUG — same OBJECTID (providerTransportId), different content
// hashes to a different occurrenceFingerprint. Confirmed reproducible cause
// of the 2026-08-18 18:17 UTC production failure.
// ===========================================================================

test('two candidates with the SAME providerTransportId but DIFFERENT fingerprints collapse to exactly one — the exact scenario that violated the DB unique constraint', () => {
  const stale = candidate({
    occurrenceFingerprint: 'digitel-v1-old-snapshot', providerEventId: 'digitel-v1-old-snapshot',
    providerTransportId: '99999', title: 'שעת סיפור בספריה', sourceUpdatedAt: '2026-08-19T07:00:00Z',
  });
  const fresh = candidate({
    occurrenceFingerprint: 'digitel-v1-new-snapshot', providerEventId: 'digitel-v1-new-snapshot',
    providerTransportId: '99999', title: 'שעת סיפור בספריה — עודכן', sourceUpdatedAt: '2026-08-19T09:00:00Z',
  });
  const result = deduplicateDigitelCandidates([stale, fresh]);
  assert.equal(result.uniqueCandidates.length, 1, 'exactly one candidate must survive per transport id, never two');
  assert.equal(result.uniqueCandidates[0].providerTransportId, '99999');
  assert.equal(result.duplicateRecordCount, 1);
});

test('the freshest sourceUpdatedAt wins when transport ids collide', () => {
  const older = candidate({ occurrenceFingerprint: 'fp-older', providerEventId: 'fp-older', providerTransportId: '500', sourceUpdatedAt: '2026-08-19T06:00:00Z' });
  const newer = candidate({ occurrenceFingerprint: 'fp-newer', providerEventId: 'fp-newer', providerTransportId: '500', sourceUpdatedAt: '2026-08-19T12:00:00Z' });
  const result = deduplicateDigitelCandidates([older, newer]);
  assert.equal(result.uniqueCandidates.length, 1);
  assert.equal(result.uniqueCandidates[0].occurrenceFingerprint, 'fp-newer');
});

test('a missing sourceUpdatedAt loses to a candidate that has one, for the same transport id', () => {
  const unknown = candidate({ occurrenceFingerprint: 'fp-unknown', providerEventId: 'fp-unknown', providerTransportId: '777', sourceUpdatedAt: null });
  const known = candidate({ occurrenceFingerprint: 'fp-known', providerEventId: 'fp-known', providerTransportId: '777', sourceUpdatedAt: '2026-08-19T10:00:00Z' });
  const result = deduplicateDigitelCandidates([unknown, known]);
  assert.equal(result.uniqueCandidates.length, 1);
  assert.equal(result.uniqueCandidates[0].occurrenceFingerprint, 'fp-known');
});

test('three-way transport-id collision still collapses to exactly one, freshest wins', () => {
  const a = candidate({ occurrenceFingerprint: 'fp-a', providerEventId: 'fp-a', providerTransportId: '1', sourceUpdatedAt: '2026-08-19T05:00:00Z' });
  const b = candidate({ occurrenceFingerprint: 'fp-b', providerEventId: 'fp-b', providerTransportId: '1', sourceUpdatedAt: '2026-08-19T15:00:00Z' });
  const c = candidate({ occurrenceFingerprint: 'fp-c', providerEventId: 'fp-c', providerTransportId: '1', sourceUpdatedAt: '2026-08-19T10:00:00Z' });
  const result = deduplicateDigitelCandidates([a, b, c]);
  assert.equal(result.uniqueCandidates.length, 1);
  assert.equal(result.uniqueCandidates[0].occurrenceFingerprint, 'fp-b');
});

// ===========================================================================
// EXISTING BEHAVIOR — same fingerprint (the routine, already-handled case,
// e.g. ArcGIS pagination returning the exact same record twice) must keep
// working unchanged.
// ===========================================================================

test('two candidates with the SAME fingerprint (true exact duplicates) still collapse to one, as before', () => {
  const a = candidate({ providerTransportId: '111' });
  const b = candidate({ providerTransportId: '111' });
  const result = deduplicateDigitelCandidates([a, b]);
  assert.equal(result.uniqueCandidates.length, 1);
  assert.equal(result.duplicateRecordCount, 1);
});

test('candidates with different fingerprints AND different transport ids are all kept — no over-collapsing', () => {
  const a = candidate({ occurrenceFingerprint: 'fp-1', providerEventId: 'fp-1', providerTransportId: '1' });
  const b = candidate({ occurrenceFingerprint: 'fp-2', providerEventId: 'fp-2', providerTransportId: '2' });
  const c = candidate({ occurrenceFingerprint: 'fp-3', providerEventId: 'fp-3', providerTransportId: '3' });
  const result = deduplicateDigitelCandidates([a, b, c]);
  assert.equal(result.uniqueCandidates.length, 3);
  assert.equal(result.duplicateRecordCount, 0);
});

test('an empty candidate list produces an empty, well-formed result', () => {
  const result = deduplicateDigitelCandidates([]);
  assert.deepEqual(result.uniqueCandidates, []);
  assert.deepEqual(result.duplicateGroups, []);
  assert.equal(result.duplicateRecordCount, 0);
});

// ===========================================================================
// INVARIANT — the output can never contain two rows with the same
// providerTransportId, whatever the input shape. This is the actual
// guarantee the DB unique constraint requires upstream of the RPC.
// ===========================================================================

test('invariant: deduplicateDigitelCandidates never returns two candidates sharing a providerTransportId', () => {
  const inputs = [
    candidate({ occurrenceFingerprint: 'fp-1', providerEventId: 'fp-1', providerTransportId: '42' }),
    candidate({ occurrenceFingerprint: 'fp-2', providerEventId: 'fp-2', providerTransportId: '42' }),
    candidate({ occurrenceFingerprint: 'fp-3', providerEventId: 'fp-3', providerTransportId: '43' }),
    candidate({ occurrenceFingerprint: 'fp-3', providerEventId: 'fp-3', providerTransportId: '43' }),
    candidate({ occurrenceFingerprint: 'fp-4', providerEventId: 'fp-4', providerTransportId: '44' }),
  ];
  const result = deduplicateDigitelCandidates(inputs);
  const transportIds = result.uniqueCandidates.map((c) => c.providerTransportId);
  assert.equal(transportIds.length, new Set(transportIds).size, 'no duplicate providerTransportId in the output');
});
