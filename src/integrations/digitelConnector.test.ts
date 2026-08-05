import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  buildDigitelQueryUrl,
  DigitelConnectorError,
  fetchAllDigitelFeatures,
  fetchAndValidateDigitelSource,
  groupFingerprintCollisions,
  MAX_DIGITEL_PAGE_SIZE,
  normalizeArcGisDate,
  normalizeDigitelFeatures,
  normalizeDigitelText,
  validateDigitelSourceMetadata,
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

test('transient ArcGIS failures are retried before succeeding', async () => {
  let calls = 0;
  const result = await fetchAllDigitelFeatures({
    maxAttempts: 3,
    retryBaseDelayMs: 0,
    sleepImpl: async () => undefined,
    fetchImpl: async () => {
      calls += 1;
      return calls < 3 ? response({}, 503) : response({ features: [feature(1)], exceededTransferLimit: false });
    },
  });
  assert.equal(calls, 3);
  assert.equal(result.requestAttempts, 3);
  assert.equal(result.retryCount, 2);
});

test('permanent HTTP failures are not retried', async () => {
  let calls = 0;
  await assert.rejects(fetchAllDigitelFeatures({
    maxAttempts: 3,
    retryBaseDelayMs: 0,
    sleepImpl: async () => undefined,
    fetchImpl: async () => { calls += 1; return response({}, 400); },
  }), (error: unknown) => error instanceof DigitelConnectorError && error.code === 'HTTP_ERROR' && error.status === 400);
  assert.equal(calls, 1);
});

test('requests time out, retry to the configured limit, and never hang', async () => {
  let calls = 0;
  const neverCompletes: typeof fetch = async (_url, init) => {
    calls += 1;
    return await new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(init.signal?.reason), { once: true });
    });
  };
  await assert.rejects(fetchAllDigitelFeatures({
    fetchImpl: neverCompletes,
    timeoutMs: 5,
    maxAttempts: 2,
    retryBaseDelayMs: 0,
    sleepImpl: async () => undefined,
  }), (error: unknown) => error instanceof DigitelConnectorError && error.code === 'TIMEOUT');
  assert.equal(calls, 2);
});

test('source metadata validation detects schema drift before fetching records', async () => {
  const metadata = {
    id: 410,
    name: 'אירועים דיגיתל',
    type: 'Feature Layer',
    geometryType: 'esriGeometryPoint',
    maxRecordCount: 2_000,
    capabilities: 'Map,Query,Data',
    fields: [
      'OBJECTID', 'title', 'startdate', 'location', 'type', 'NbrId', 'description', 'summary',
      'image_url', 'icon_url', 'sitemapurl', 'modified', 'publishdate', 'lat', 'lon',
    ].map((name) => ({ name })),
  };
  const result = await fetchAndValidateDigitelSource({ fetchImpl: async () => response(metadata) });
  assert.equal(result.validation.valid, true);
  assert.equal(result.validation.missingFields.length, 0);
  assert.equal(result.requestAttempts, 1);

  const drifted = validateDigitelSourceMetadata({ ...metadata, geometryType: 'esriGeometryPolygon', fields: metadata.fields.slice(0, -1) });
  assert.equal(drifted.valid, false);
  assert.ok(drifted.errors.includes('unexpected_geometry_type'));
  assert.deepEqual(drifted.missingFields, ['lon']);
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
