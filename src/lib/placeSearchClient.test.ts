import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('mobile Places contract contains no provider credentials or endpoints', async () => {
  const source = await readFile(new URL('./placeSearchClient.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /APPLE_MAPS_(TEAM_ID|KEY_ID|PRIVATE_KEY)/);
  assert.doesNotMatch(source, /maps-api\.apple\.com/);
  assert.doesNotMatch(source, /BEGIN PRIVATE KEY/);
});

test('Expo location search remains active until Stage 2', async () => {
  const source = await readFile(new URL('../hooks/usePlaceSearch.ts', import.meta.url), 'utf8');
  assert.match(source, /Location\.geocodeAsync/);
  assert.doesNotMatch(source, /functions\.invoke/);
});

