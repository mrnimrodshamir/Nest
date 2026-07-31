import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateActivityTitle, relativeDayWord } from './generateActivityTitle.ts';

test('relativeDayWord: same calendar day is Today', () => {
  const now = new Date(2026, 6, 31, 9, 0);
  const later = new Date(2026, 6, 31, 18, 0);
  assert.equal(relativeDayWord(later, now), 'Today');
});

test('relativeDayWord: next calendar day is Tomorrow', () => {
  const now = new Date(2026, 6, 31, 23, 0);
  const tomorrowMorning = new Date(2026, 7, 1, 6, 0);
  assert.equal(relativeDayWord(tomorrowMorning, now), 'Tomorrow');
});

test('relativeDayWord: further out is the weekday name', () => {
  const now = new Date(2026, 6, 27); // Monday
  const friday = new Date(2026, 6, 31);
  assert.equal(relativeDayWord(friday, now), 'Friday');
});

test('generateActivityTitle: joins type, day, and short location', () => {
  const startsAt = new Date();
  startsAt.setHours(startsAt.getHours() + 2);
  const title = generateActivityTitle('stroller_walk', startsAt, 'HaYarkon Park, main entrance');
  assert.ok(title.startsWith('Stroller walk ·'));
  assert.ok(title.endsWith('HaYarkon Park'));
});

test('generateActivityTitle: strips address detail after the first comma', () => {
  const startsAt = new Date();
  startsAt.setHours(startsAt.getHours() + 2);
  const title = generateActivityTitle('coffee_meetup', startsAt, 'Dizengoff Square, near the fountain');
  assert.ok(title.includes('Dizengoff Square'));
  assert.ok(!title.includes('near the fountain'));
});

test('generateActivityTitle: empty location name omits the location segment', () => {
  const startsAt = new Date();
  startsAt.setHours(startsAt.getHours() + 2);
  const title = generateActivityTitle('picnic', startsAt, '');
  assert.equal(title.split(' · ').length, 2);
});
