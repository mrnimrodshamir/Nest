import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('mobile Places contract contains no provider credentials or endpoints', async () => {
  const source = await readFile(new URL('./placeSearchClient.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /APPLE_MAPS_(TEAM_ID|KEY_ID|PRIVATE_KEY)/);
  assert.doesNotMatch(source, /maps-api\.apple\.com/);
  assert.doesNotMatch(source, /BEGIN PRIVATE KEY/);
});

test('Stage 2 text search uses the provider-neutral client while Expo Location stays out of the hook', async () => {
  const source = await readFile(new URL('../hooks/usePlaceSearch.ts', import.meta.url), 'utf8');
  assert.match(source, /invokePlaceSearch/);
  assert.doesNotMatch(source, /expo-location|maps-api\.apple\.com/);
});
