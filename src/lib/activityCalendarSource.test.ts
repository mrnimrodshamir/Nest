import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

test('iOS calendar integration uses Expo 57 legacy implementation, not throwing root stubs', () => {
  const source = readFileSync(new URL('./activityCalendar.ts', import.meta.url), 'utf8');
  assert.match(source, /from 'expo-calendar\/legacy'/);
  assert.doesNotMatch(source, /from 'expo-calendar';/);
  assert.match(source, /getCalendarsAsync\(Calendar\.EntityTypes\.EVENT\)/);
  assert.match(source, /timeZone: 'Asia\/Jerusalem'/);
  assert.match(source, /activityDeepLink\(activity\.id\)/);
  assert.match(source, /await Calendar\.updateEventAsync\(stored\.eventId/);
});
