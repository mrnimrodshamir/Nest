import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parentRoleNoun,
  parentOfLabel,
  trustContextLine,
  isParentRole,
  coerceParentRole,
} from './parentRole.ts';

// ---------------------------------------------------------------------
// Role noun — never inferred, null is neutral
// ---------------------------------------------------------------------

test('explicit roles render their chosen noun', () => {
  assert.equal(parentRoleNoun('mom'), 'Mom');
  assert.equal(parentRoleNoun('dad'), 'Dad');
  assert.equal(parentRoleNoun('parent'), 'Parent');
});

test('null degrades to the neutral Parent, never a guess', () => {
  assert.equal(parentRoleNoun(null), 'Parent');
});

test('an unrecognised stored value degrades to Parent rather than leaking through', () => {
  // A future enum value arriving before the client knows about it.
  assert.equal(parentRoleNoun('grandparent' as never), 'Parent');
  assert.equal(coerceParentRole('grandparent'), null);
  assert.equal(coerceParentRole(undefined), null);
  assert.equal(coerceParentRole(42), null);
});

test('role takes no input that could imply gender', () => {
  // The signature accepts ONLY the stored role. There is no name, photo,
  // child or relationship parameter that could be used to infer one.
  assert.equal(parentRoleNoun.length, 1);
  assert.equal(isParentRole('mom'), true);
  assert.equal(isParentRole('Mom'), false, 'matching must be exact, not fuzzy');
});

// ---------------------------------------------------------------------
// Child-list copy — preserves the approved concise format
// ---------------------------------------------------------------------

test('one child', () => {
  assert.equal(parentOfLabel('mom', ['Ido']), 'Mom of Ido');
  assert.equal(parentOfLabel(null, ['Ido']), 'Parent of Ido');
});

test('two children joined with and', () => {
  assert.equal(parentOfLabel('dad', ['Go', 'Yo']), 'Dad of Go and Yo');
});

test('three or more uses +N counting ALL remaining children', () => {
  assert.equal(parentOfLabel('mom', ['Go', 'Yo', 'Zo']), 'Mom of Go, Yo +1');
  assert.equal(parentOfLabel('mom', ['Go', 'Yo', 'Zo', 'Bo']), 'Mom of Go, Yo +2');
  assert.equal(parentOfLabel(null, ['A', 'B', 'C', 'D', 'E']), 'Parent of A, B +3');
});

test('zero children renders the role alone, never a dangling "of"', () => {
  assert.equal(parentOfLabel('mom', []), 'Mom');
  assert.equal(parentOfLabel(null, []), 'Parent');
});

test('blank and whitespace-only names are ignored, not rendered as gaps', () => {
  assert.equal(parentOfLabel('mom', ['Go', '  ', '']), 'Mom of Go');
  assert.equal(parentOfLabel('mom', ['  Go  ']), 'Mom of Go');
});

// ---------------------------------------------------------------------
// Trust context — count not names, area not coordinates
// ---------------------------------------------------------------------

test('area and child count combine', () => {
  assert.equal(trustContextLine({ neighborhood: 'Florentin', childCount: 2 }), 'Florentin · 2 children');
});

test('one child is singular', () => {
  assert.equal(trustContextLine({ neighborhood: 'Florentin', childCount: 1 }), 'Florentin · 1 child');
});

test('missing area degrades to the count alone', () => {
  assert.equal(trustContextLine({ neighborhood: null, childCount: 2 }), '2 children');
});

test('missing count degrades to the area alone', () => {
  assert.equal(trustContextLine({ neighborhood: 'Florentin', childCount: 0 }), 'Florentin');
});

test('nothing known renders empty rather than a stray separator', () => {
  assert.equal(trustContextLine({}), '');
  assert.equal(trustContextLine({ neighborhood: '   ', childCount: 0 }), '');
});

test('PRIVACY: trust context exposes no names, coordinates or contact data', () => {
  const line = trustContextLine({ neighborhood: 'Florentin', childCount: 3 });
  assert.ok(!/\d+\.\d{3,}/.test(line), 'coordinates must never appear');
  assert.ok(!/@/.test(line), 'email must never appear');
  assert.equal(line, 'Florentin · 3 children');
});
