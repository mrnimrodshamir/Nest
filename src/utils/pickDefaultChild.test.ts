import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickDefaultChild } from './pickDefaultChild.ts';

test('pickDefaultChild: no children returns null', () => {
  assert.equal(pickDefaultChild([]), null);
});

test('pickDefaultChild: a single child is picked even when not marked default', () => {
  const only = { id: 'only', isDefault: false };
  assert.equal(pickDefaultChild([only]), only);
});

test('pickDefaultChild: among multiple children, the one marked default wins', () => {
  const first = { id: 'first', isDefault: false };
  const marked = { id: 'marked', isDefault: true };
  const third = { id: 'third', isDefault: false };
  assert.equal(pickDefaultChild([first, marked, third]), marked);
});

test('pickDefaultChild: if the marked default was deleted, falls back to the first remaining child', () => {
  const remainingFirst = { id: 'remaining-first', isDefault: false };
  const remainingSecond = { id: 'remaining-second', isDefault: false };
  assert.equal(pickDefaultChild([remainingFirst, remainingSecond]), remainingFirst);
});
