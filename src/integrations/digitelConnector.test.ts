import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  buildDigitelQueryUrl,
  fetchAllDigitelFeatures,
  groupFingerprintCollisions,
  MAX_DIGITEL_PAGE_SIZE,
  normalizeArcGisDate,
  normalizeDigitelFeatures,
  normalizeDigitelText,
  type ArcGisFeature,
  type ArcGisFeatureResponse,
} from '@/integrations/digitelConnector';

const fixture = JSON.parse(await readFile(new URL('./fixtures/digitel-page.json', import.meta.url), 'utf8')) as ArcGisFeatureResponse;
const now = new Date('2026-08-05T12:00:00.000Z');

function feature(objectId: number): ArcGisFeature {
  return {
    attributes: {
      OBJECTID: objectId,
      title: `Event ${objectId}`,
      startdate: Date.parse('2026-08-06T10:00:00Z'),
      location: 'Tel Aviv',
      type: 'אירועים בתוקף',
      NbrId: 1,
      lat: 32.08,
      lon: 34.78,
    },
    geometry: { x: 34.78, y: 32.08 },
  };
}

function response(body: ArcGisFeatureResponse, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

test('pagination requests every page with the reviewed ArcGIS contract', async () => {
  const urls: string[] = [];
  const pages: ArcGisFeatureResponse[] = [
    { features: [feature(1), feature(2)], exceededTransferLimit: true },
    { features: [feature(3)], exceededTransferLimit: false },
  ];
  const result = await fetchAllDigitelFeatures({
    pageSize: 2,
    fetchImpl: async (url) => { urls.push(String(url)); return response(pages.shift()!); },
  });
  assert.equal(result.pages, 2);
  assert.deepEqual(result.features.map((row) => row.attributes?.OBJECTID), [1, 2, 3]);
  assert.equal(new URL(urls[0]).searchParams.get('resultOffset'), '0');
  assert.equal(new URL(urls[1]).searchParams.get('resultOffset'), '2');
  assert.equal(new URL(urls[0]).searchParams.get('orderByFields'), 'modified ASC, OBJECTID ASC');
  assert.equal(new URL(urls[0]).searchParams.get('returnGeometry'), 'true');
  assert.equal(new URL(urls[0]).searchParams.get('outSR'), '4326');
});

test('ArcGIS errors and HTTP errors are surfaced without partial success', async () => {
  await assert.rejects(
    fetchAllDigitelFeatures({ fetchImpl: async () => response({ error: { code: 400, message: 'Bad query' } }) }),
    /ArcGIS error 400: Bad query/,
  );
  await assert.rejects(
    fetchAllDigitelFeatures({ fetchImpl: async () => response({}, 503) }),
    /HTTP 503/,
  );
});

test('page size is capped at the ArcGIS response limit', () => {
  const url = new URL(buildDigitelQueryUrl(0, Number.MAX_SAFE_INTEGER));
  assert.equal(url.searchParams.get('resultRecordCount'), String(MAX_DIGITEL_PAGE_SIZE));
});

test('a repeated stale page is rejected instead of causing an infinite loop', async () => {
  const repeated = { features: [feature(1)], exceededTransferLimit: true };
  await assert.rejects(
    fetchAllDigitelFeatures({ pageSize: 1, fetchImpl: async () => response(repeated), maxPages: 3 }),
    /repeated a stale page/,
  );
});

test('sentinel dates and notices are excluded with every applicable reason', () => {
  const result = normalizeDigitelFeatures(fixture.features!, { now });
  const notice = result.excluded.find((row) => row.objectId === 102)!;
  assert.ok(notice.reasons.includes('notice'));
  assert.ok(notice.reasons.includes('invalid_or_implausible_start_date'));
  assert.equal(normalizeArcGisDate(-2209161600000, now), null);
});

test('Hebrew whitespace and HTML descriptions normalize without losing content', () => {
  assert.equal(normalizeDigitelText('  שלום\u00a0  עולם\nחדש '), 'שלום עולם חדש');
  const result = normalizeDigitelFeatures(fixture.features!, { now });
  const candidate = result.candidates.find((row) => row.providerTransportId === '101')!;
  assert.equal(candidate.title, 'שעת סיפור בגן');
  assert.equal(candidate.description, 'סיפור & יצירה למשפחות');
});

test('malformed geometry and missing titles are preserved in exclusion reporting', () => {
  const result = normalizeDigitelFeatures(fixture.features!, { now });
  assert.ok(result.excluded.find((row) => row.objectId === 103)?.reasons.includes('invalid_coordinates'));
  assert.ok(result.excluded.find((row) => row.objectId === 104)?.reasons.includes('missing_title'));
});

test('normalized candidates leave unsupported event claims null', () => {
  const candidate = normalizeDigitelFeatures(fixture.features!, { now }).candidates[0];
  assert.equal(candidate.endTime, null);
  assert.equal(candidate.ageMinMonths, null);
  assert.equal(candidate.price, null);
  assert.equal(candidate.registrationRequired, null);
  assert.equal(candidate.cancellationStatus, null);
});

test('duplicate occurrence fingerprints are reported while OBJECTID and NbrId stay source metadata', () => {
  const candidates = normalizeDigitelFeatures(fixture.features!, { now }).candidates;
  const duplicates = groupFingerprintCollisions(candidates);
  assert.equal(duplicates.length, 1);
  assert.deepEqual(duplicates[0].map((row) => row.providerTransportId), ['101', '105']);
  assert.notEqual(duplicates[0][0].sourceGroupId, duplicates[0][1].sourceGroupId);
  assert.equal(duplicates[0][0].providerEventId, duplicates[0][1].providerEventId);
});
