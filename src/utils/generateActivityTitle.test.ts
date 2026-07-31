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

test('relativeDayWord: an activity at exactly midnight the same calendar day is Today', () => {
  const now = new Date(2026, 6, 31, 22, 0);
  const midnightTonight = new Date(2026, 6, 31, 0, 0);
  assert.equal(relativeDayWord(midnightTonight, now), 'Today');
});

test('relativeDayWord: one minute past midnight the next calendar day is Tomorrow, not Today', () => {
  const now = new Date(2026, 6, 31, 23, 59);
  const justAfterMidnight = new Date(2026, 7, 1, 0, 1);
  assert.equal(relativeDayWord(justAfterMidnight, now), 'Tomorrow');
});

const NOW = new Date(2026, 6, 31, 8, 0); // Friday, Jul 31 2026, 8am

test('generateActivityTitle: today reads as a natural sentence with no redundant "today"', () => {
  const title = generateActivityTitle('coffee_meetup', new Date(2026, 6, 31, 10, 0), 'Dizengoff Square, near the fountain', NOW);
  assert.equal(title, 'Coffee meetup at Dizengoff Square');
});

test('generateActivityTitle: tomorrow matches the product example exactly', () => {
  const title = generateActivityTitle('stroller_walk', new Date(2026, 7, 1, 9, 0), 'HaYarkon Park', NOW);
  assert.equal(title, 'Stroller walk tomorrow at HaYarkon Park');
});

test('generateActivityTitle: a further-out weekday matches the product example exactly', () => {
  const title = generateActivityTitle('yoga', new Date(2026, 8, 4, 8, 0), 'Tel Aviv Port', NOW);
  assert.equal(title, 'Yoga on Friday at Tel Aviv Port');
});

test('generateActivityTitle: never collapses to a bare category word', () => {
  const title = generateActivityTitle('coffee_meetup', new Date(2026, 6, 31, 10, 0), 'Dizengoff Square', NOW);
  assert.notEqual(title, 'Coffee meetup');
  assert.ok(title.length > 'Coffee meetup'.length);
});

test('generateActivityTitle: strips address detail after the first comma', () => {
  const title = generateActivityTitle('coffee_meetup', new Date(2026, 6, 31, 10, 0), 'Dizengoff Square, near the fountain', NOW);
  assert.ok(title.includes('Dizengoff Square'));
  assert.ok(!title.includes('near the fountain'));
});

test('generateActivityTitle: empty location name still reads as a complete phrase', () => {
  const title = generateActivityTitle('picnic', new Date(2026, 6, 31, 10, 0), '', NOW);
  assert.equal(title, 'Picnic');
});

test('generateActivityTitle: unrecognized category falls back to "Other" rather than crashing', () => {
  const title = generateActivityTitle('some_future_category', new Date(2026, 6, 31, 10, 0), '', NOW);
  assert.equal(title, 'Other');
});
