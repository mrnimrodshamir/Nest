import assert from 'node:assert/strict';
import test from 'node:test';
import { adaptAutocompleteResponse, adaptPlacesResponse } from './appleAdapter.ts';
import { AppleMapsClient } from './appleMapsClient.ts';
import { decodeCompletionToken, encodeCompletionToken, validateAppleCompletionUrl } from './completionToken.ts';
import { PlaceFunctionError } from './errors.ts';
import { handlePlaceRequest } from './handler.ts';
import { AppleMapsTokenService, readAppleTokenConfiguration } from './tokenService.ts';
import { validateRequest } from './validation.ts';

test('validates actions, query length, coordinates, language, and result limit', () => {
  assert.throws(() => validateRequest({ action: 'search', query: 'a' }), /between 2 and 100/);
  assert.throws(() => validateRequest({ action: 'search', query: 'park', language: 'fr' }), /language/);
  assert.throws(() => validateRequest({ action: 'search', query: 'park', center: { latitude: 91, longitude: 0 } }), /center/);
  assert.throws(() => validateRequest({ action: 'search', query: 'park', limit: 9 }), /Limit/);
  assert.equal(validateRequest({ action: 'search', query: 'גן', language: 'he', limit: 8 }).query, 'גן');
});

test('requires authentication before parsing or calling the provider', async () => {
  let called = false;
  const response = await handlePlaceRequest(new Request('https://local.test', { method: 'POST', body: '{}' }), {
    authenticate: async () => false,
    consumeRateLimit: async () => true,
    executeAppleRequest: async () => { called = true; return { kind: 'places', places: [] }; },
  });
  assert.equal(response.status, 401);
  assert.equal(called, false);
});

test('enforces the provider-independent database rate limit', async () => {
  const response = await requestThroughHandler({ action: 'search', query: 'park' }, { consumeRateLimit: async () => false });
  assert.equal(response.status, 429);
  assert.equal((await response.json()).error.code, 'RATE_LIMITED');
});

test('maps missing configuration without exposing environment details', async () => {
  const response = await requestThroughHandler({ action: 'search', query: 'park' }, {
    executeAppleRequest: async () => { throw new PlaceFunctionError('CONFIGURATION_MISSING', 'Place search is not configured.', 503); },
  });
  const body = await response.text();
  assert.equal(response.status, 503);
  assert.match(body, /CONFIGURATION_MISSING/);
  assert.doesNotMatch(body, /PRIVATE KEY|TEAM_ID|KEY_ID/);
});

test('normalizes Hebrew and English places and removes duplicates', () => {
  const payload = { results: [
    { id: '1', name: 'גן מאיר', coordinate: { latitude: 32.073, longitude: 34.774 }, formattedAddressLines: ['תל אביב'], poiCategory: 'Park' },
    { id: '1', name: 'Duplicate', coordinate: { latitude: 32.073, longitude: 34.774 } },
    { id: '2', name: 'Hayarkon Park', coordinate: { latitude: 32.1, longitude: 34.8 } },
  ] };
  const places = adaptPlacesResponse(payload, 8);
  assert.equal(places.length, 2);
  assert.equal(places[0].name, 'גן מאיר');
  assert.equal(places[1].name, 'Hayarkon Park');
  assert.deepEqual(Object.keys(places[0]).sort(), ['category', 'formattedAddress', 'latitude', 'longitude', 'name', 'provider', 'providerPlaceId', 'source', 'wasAdjusted'].sort());
});

test('drops malformed place candidates and rejects malformed provider envelopes', () => {
  assert.deepEqual(adaptPlacesResponse({ results: [{ name: 'Bad', coordinate: { latitude: 200, longitude: 1 } }] }, 8), []);
  assert.throws(() => adaptPlacesResponse({ unexpected: true }, 8), /invalid response/);
});

test('normalizes autocomplete without leaking raw completion URLs', () => {
  const suggestions = adaptAutocompleteResponse({ results: [
    { displayLines: ['Museum', 'Tel Aviv'], completionUrl: '/v1/search?q=Museum' },
    { displayLines: ['Museum duplicate'], completionUrl: '/v1/search?q=Museum' },
  ] }, 8);
  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].name, 'Museum');
  assert.ok(suggestions[0].resolutionToken);
  assert.equal(JSON.stringify(suggestions).includes('/v1/search'), false);
});

test('completion tokens only resolve to the fixed Apple origin and search paths', () => {
  const token = encodeCompletionToken('/v1/search?q=park');
  assert.equal(decodeCompletionToken(token).origin, 'https://maps-api.apple.com');
  assert.throws(() => validateAppleCompletionUrl('https://evil.example/v1/search?q=park'), /Invalid completion URL/);
  assert.throws(() => validateAppleCompletionUrl('/v1/token'), /Invalid completion URL/);
});

test('Apple client maps 429, 5xx, timeout, and malformed JSON safely', async () => {
  const request = validateRequest({ action: 'search', query: 'park' });
  const make = (implementation: typeof fetch) => new AppleMapsClient({ getAccessToken: async () => 'access-token' }, implementation);
  await assert.rejects(() => make(async () => new Response('{}', { status: 429 })).execute(request), (error: any) => error.code === 'RATE_LIMITED');
  await assert.rejects(() => make(async () => new Response('token rejected', { status: 401 })).execute(request), (error: any) => error.code === 'CONFIGURATION_MISSING' && !error.message.includes('rejected'));
  await assert.rejects(() => make(async () => new Response('upstream secret error', { status: 500 })).execute(request), (error: any) => error.code === 'PROVIDER_UNAVAILABLE' && !error.message.includes('secret'));
  await assert.rejects(() => make(async () => new Response('not-json', { status: 200 })).execute(request), (error: any) => error.code === 'MALFORMED_PROVIDER_RESPONSE');
  await assert.rejects(() => make(async () => { throw new DOMException('timed out', 'TimeoutError'); }).execute(request), (error: any) => error.code === 'TIMEOUT');
});

test('autocomplete, search, and completion resolution use mocked Apple responses', async () => {
  const completionToken = encodeCompletionToken('/v1/search?q=Resolved%20Cafe');
  const requestedPaths: string[] = [];
  const client = new AppleMapsClient({ getAccessToken: async () => 'token' }, async (input) => {
    const url = new URL(String(input));
    requestedPaths.push(`${url.pathname}?${url.searchParams.toString()}`);
    if (url.pathname === '/v1/searchAutocomplete') {
      return Response.json({ results: [{ displayLines: ['Cafe', 'Tel Aviv'], completionUrl: '/v1/search?q=Resolved%20Cafe' }] });
    }
    return Response.json({ results: [{ name: 'Resolved Cafe', coordinate: { latitude: 32.08, longitude: 34.78 } }] });
  });
  const autocomplete = await client.execute(validateRequest({ action: 'autocomplete', query: 'ca' }));
  const search = await client.execute(validateRequest({ action: 'search', query: 'cafe' }));
  const details = await client.execute(validateRequest({ action: 'place_details', completionToken }));
  assert.equal(autocomplete.kind, 'suggestions');
  assert.equal(search.kind, 'places');
  assert.equal(details.kind, 'places');
  assert.equal(requestedPaths.length, 3);
});

test('Apple client constructs biased Hebrew search and honors the limit', async () => {
  let requested = '';
  const client = new AppleMapsClient({ getAccessToken: async () => 'token' }, async (input) => {
    requested = String(input);
    return Response.json({ results: [] });
  });
  await client.execute(validateRequest({ action: 'search', query: 'בית קפה', language: 'he', countryCode: 'IL', center: { latitude: 32.08, longitude: 34.78 }, limit: 8 }));
  const url = new URL(requested);
  assert.equal(url.searchParams.get('lang'), 'he-IL');
  assert.equal(url.searchParams.get('limitToCountries'), 'IL');
  assert.equal(url.searchParams.get('searchLocation'), '32.08,34.78');
  // Apple exposes no result-count parameter; the adapter enforces the
  // provider-neutral maximum before returning data to the client.
  assert.equal(url.searchParams.has('limit'), false);
});

test('token service caches access tokens and refreshes before expiry', async () => {
  const keyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const privateBytes = new Uint8Array(await crypto.subtle.exportKey('pkcs8', keyPair.privateKey));
  const privateKey = `-----BEGIN PRIVATE KEY-----\n${Buffer.from(privateBytes).toString('base64')}\n-----END PRIVATE KEY-----`;
  let now = 1_700_000_000_000;
  let calls = 0;
  const service = new AppleMapsTokenService({ teamId: 'TEAMID1234', keyId: 'KEYID12345', privateKey }, {
    crypto,
    now: () => now,
    fetch: async (_input, init) => {
      calls += 1;
      assert.match(String((init?.headers as Record<string, string>).Authorization), /^Bearer [^.]+\.[^.]+\.[^.]+$/);
      return Response.json({ accessToken: `access-${calls}`, expiresInSeconds: 120 });
    },
  });
  assert.equal(await service.getAccessToken(), 'access-1');
  assert.equal(await service.getAccessToken(), 'access-1');
  now += 61_000;
  assert.equal(await service.getAccessToken(), 'access-2');
  assert.equal(calls, 2);
});

test('configuration reader reports missing secrets without values', () => {
  assert.throws(() => readAppleTokenConfiguration(() => undefined), (error: any) => error.code === 'CONFIGURATION_MISSING' && !error.message.includes('APPLE_MAPS'));
});

async function requestThroughHandler(body: unknown, overrides: Partial<Parameters<typeof handlePlaceRequest>[1]> = {}) {
  return handlePlaceRequest(new Request('https://local.test', { method: 'POST', headers: { Authorization: 'Bearer user-token', 'Content-Type': 'application/json' }, body: JSON.stringify(body) }), {
    authenticate: async () => true,
    consumeRateLimit: async () => true,
    executeAppleRequest: async () => ({ kind: 'places', places: [] }),
    ...overrides,
  });
}
