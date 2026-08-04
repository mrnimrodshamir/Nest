import assert from 'node:assert/strict';
import test from 'node:test';
import { PlaceSearchCoordinator, languageForQuery, PLACE_SEARCH_DEBOUNCE_MS, type PlaceSearchScheduler, type PlaceSearchState } from './placeSearchCoordinator.ts';

const center = { latitude: 32.0853, longitude: 34.7818 };

function fakeScheduler() {
  const callbacks: Array<() => void> = [];
  const scheduler: PlaceSearchScheduler = {
    setTimeout(callback, delay) {
      assert.equal(delay, PLACE_SEARCH_DEBOUNCE_MS);
      callbacks.push(callback);
      return callbacks.length as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeout() {},
  };
  return { scheduler, fire: () => callbacks.shift()?.(), count: () => callbacks.length };
}

function observe(coordinator: PlaceSearchCoordinator) {
  let state!: PlaceSearchState;
  coordinator.subscribe((next) => { state = next; });
  return () => state;
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

test('query shorter than two characters never invokes search', async () => {
  let calls = 0;
  const timer = fakeScheduler();
  const coordinator = new PlaceSearchCoordinator(async () => { calls++; return { kind: 'places', places: [] }; }, timer.scheduler);
  coordinator.setQuery('a', center);
  assert.equal(timer.count(), 0);
  assert.equal(calls, 0);
});

test('search is debounced by 350ms and identical query+center is suppressed', async () => {
  let calls = 0;
  const timer = fakeScheduler();
  const coordinator = new PlaceSearchCoordinator(async () => { calls++; return { kind: 'places', places: [] }; }, timer.scheduler);
  coordinator.setQuery('park', center);
  assert.equal(calls, 0);
  timer.fire(); await flush();
  assert.equal(calls, 1);
  coordinator.setQuery('park', center);
  assert.equal(timer.count(), 0);
});

test('Hebrew and English queries select the correct language and Israel/center bias', async () => {
  const requests: any[] = [];
  const timer = fakeScheduler();
  const coordinator = new PlaceSearchCoordinator(async (request) => { requests.push(request); return { kind: 'places', places: [] }; }, timer.scheduler);
  coordinator.setQuery('גן שעשועים', center); timer.fire(); await flush();
  coordinator.setQuery('playground', center); timer.fire(); await flush();
  assert.equal(requests[0].language, 'he');
  assert.equal(requests[1].language, 'en');
  assert.equal(requests[0].countryCode, 'IL');
  assert.deepEqual(requests[0].center, center);
  assert.equal(languageForQuery('קפה'), 'he');
});

test('successful and empty results produce terminal states with no endless spinner', async () => {
  const responses = [
    { kind: 'places' as const, places: [{ name: 'Park', formattedAddress: null, latitude: 32, longitude: 34, category: null, provider: 'apple_maps' as const, providerPlaceId: '1', source: 'provider' as const, wasAdjusted: false as const }] },
    { kind: 'places' as const, places: [] },
  ];
  const timer = fakeScheduler();
  const coordinator = new PlaceSearchCoordinator(async () => responses.shift()!, timer.scheduler);
  const state = observe(coordinator);
  coordinator.setQuery('park', center); timer.fire(); await flush();
  assert.equal(state().status, 'results');
  coordinator.setQuery('museum', center); timer.fire(); await flush();
  assert.equal(state().status, 'empty');
});

test('stale response cannot overwrite a newer result', async () => {
  let resolveFirst!: (value: any) => void;
  const first = new Promise((resolve) => { resolveFirst = resolve; });
  let call = 0;
  const timer = fakeScheduler();
  const coordinator = new PlaceSearchCoordinator(async () => ++call === 1 ? first as any : ({ kind: 'suggestions', suggestions: [{ name: 'New', formattedAddress: null, category: null, resolutionToken: 'new' }] }), timer.scheduler);
  const state = observe(coordinator);
  coordinator.setQuery('old', center); timer.fire(); await flush();
  coordinator.setQuery('new', center); timer.fire(); await flush();
  assert.equal(state().results[0].key, 'suggestion:new');
  resolveFirst({ kind: 'suggestions', suggestions: [{ name: 'Old', formattedAddress: null, category: null, resolutionToken: 'old' }] });
  await flush();
  assert.equal(state().results[0].key, 'suggestion:new');
});

for (const [code, status] of [['TIMEOUT', 'timeout'], ['RATE_LIMITED', 'rate_limited'], ['CONFIGURATION_MISSING', 'configuration_missing'], ['UNAUTHORIZED', 'unauthorized'], ['PROVIDER_UNAVAILABLE', 'unavailable']] as const) {
  test(`${code} maps to ${status} and remains retryable`, async () => {
    const timer = fakeScheduler();
    const coordinator = new PlaceSearchCoordinator(async () => { throw Object.assign(new Error('safe'), { code }); }, timer.scheduler);
    const state = observe(coordinator);
    coordinator.setQuery('park', center); timer.fire(); await flush();
    assert.equal(state().status, status);
    if (code !== 'CONFIGURATION_MISSING') { coordinator.retry(); assert.equal(timer.count(), 1); }
  });
}

test('duplicate provider suggestions are removed and results are capped at eight', async () => {
  const timer = fakeScheduler();
  const suggestions = Array.from({ length: 10 }, (_, index) => ({ name: `P${index}`, formattedAddress: null, category: null, resolutionToken: index < 2 ? 'duplicate' : String(index) }));
  const coordinator = new PlaceSearchCoordinator(async () => ({ kind: 'suggestions', suggestions }), timer.scheduler);
  const state = observe(coordinator);
  coordinator.setQuery('places', center); timer.fire(); await flush();
  assert.equal(state().results.length, 8);
  assert.equal(new Set(state().results.map((item) => item.key)).size, 8);
});

test('suggestion selection resolves mocked place details', async () => {
  const timer = fakeScheduler();
  const place = { name: 'Resolved Cafe', formattedAddress: 'Tel Aviv', latitude: 32.08, longitude: 34.78, category: 'Cafe', provider: 'apple_maps' as const, providerPlaceId: 'resolved', source: 'provider' as const, wasAdjusted: false as const };
  const coordinator = new PlaceSearchCoordinator(async (request) => request.action === 'place_details'
    ? { kind: 'places', places: [place] }
    : { kind: 'suggestions', suggestions: [{ name: 'Cafe', formattedAddress: null, category: 'Cafe', resolutionToken: 'resolve-me' }] }, timer.scheduler);
  const state = observe(coordinator);
  coordinator.setQuery('cafe', center); timer.fire(); await flush();
  const resolved = await coordinator.resolve(state().results[0]);
  assert.deepEqual(resolved, place);
});
