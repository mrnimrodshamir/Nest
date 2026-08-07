import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectTextDirection,
  directionalIconRotation,
  isBidirectional,
  isolateText,
  physicalEdge,
  textAlignForContent,
} from './rtl.ts';

test('detects Hebrew as RTL and Latin as LTR', () => {
  assert.equal(detectTextDirection('גן משחקים'), 'rtl');
  assert.equal(detectTextDirection('Playground'), 'ltr');
});

test('direction follows the FIRST strong character in mixed text', () => {
  // Real Tel Aviv venue names mix scripts in both orders.
  assert.equal(detectTextDirection('Cafe Xoho תל אביב'), 'ltr');
  assert.equal(detectTextDirection('קפה שוהו Xoho'), 'rtl');
});

test('leading digits and punctuation are skipped, not treated as direction', () => {
  assert.equal(detectTextDirection('123 גן העיר'), 'rtl');
  assert.equal(detectTextDirection('"Playground"'), 'ltr');
});

test('direction-neutral strings return null so the caller can use the locale', () => {
  assert.equal(detectTextDirection('123'), null);
  assert.equal(detectTextDirection('— · —'), null);
  assert.equal(detectTextDirection(''), null);
  assert.equal(detectTextDirection(null), null);
});

test('English venue names stay left-aligned even in a Hebrew UI', () => {
  // The whole point: a Hebrew UI must not reverse an English name.
  assert.deepEqual(textAlignForContent('Cafe Xoho', 'he'), {
    textAlign: 'left',
    writingDirection: 'ltr',
  });
});

test('Hebrew venue names stay right-aligned even in an English UI', () => {
  assert.deepEqual(textAlignForContent('גן העיר', 'en'), {
    textAlign: 'right',
    writingDirection: 'rtl',
  });
});

test('neutral content falls back to the UI locale', () => {
  assert.equal(textAlignForContent('2026', 'he').textAlign, 'right');
  assert.equal(textAlignForContent('2026', 'en').textAlign, 'left');
});

test('isolateText wraps content in FSI/PDI so it cannot reorder its sentence', () => {
  const wrapped = isolateText('Cafe Xoho');
  assert.equal(wrapped, '⁨Cafe Xoho⁩');
  assert.ok(wrapped.startsWith('⁨') && wrapped.endsWith('⁩'));
});

test('isolateText on empty input yields an empty string, not stray marks', () => {
  assert.equal(isolateText(''), '');
  assert.equal(isolateText(null), '');
});

test('isBidirectional only flags genuinely mixed strings', () => {
  assert.equal(isBidirectional('Cafe Xoho תל אביב'), true);
  assert.equal(isBidirectional('Playground'), false);
  assert.equal(isBidirectional('גן משחקים'), false);
  assert.equal(isBidirectional(''), false);
});

test('logical edges map to mirrored physical edges', () => {
  assert.equal(physicalEdge('start', 'en'), 'left');
  assert.equal(physicalEdge('end', 'en'), 'right');
  assert.equal(physicalEdge('start', 'he'), 'right');
  assert.equal(physicalEdge('end', 'he'), 'left');
});

test('directional icons flip in Hebrew and only in Hebrew', () => {
  assert.equal(directionalIconRotation('en'), 0);
  assert.equal(directionalIconRotation('he'), 180);
});
