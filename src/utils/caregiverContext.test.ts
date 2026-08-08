import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildCaregiverContext, parentRoleWithCount } from './caregiverContext.ts';

test('full context: area, role and count', () => {
  const c = buildCaregiverContext({
    neighborhood: 'Florentin', parentRole: 'mom', childCount: 2,
    occupation: 'Product Designer', bio: 'Loves long stroller walks.',
  });
  // Order is age · role · area, matching the approved "27 · Dad of 3 / Tel Aviv".
  assert.equal(c.context, 'Mom of 2 · Florentin');
  assert.equal(c.occupation, 'Product Designer');
  assert.equal(c.bio, 'Loves long stroller walks.');
});

test('occupation missing is omitted, not rendered blank', () => {
  const c = buildCaregiverContext({ neighborhood: 'Florentin', parentRole: 'mom', childCount: 2 });
  assert.equal(c.context, 'Mom of 2 · Florentin');
  assert.equal(c.occupation, null);
});

test('neighborhood missing collapses to the role line alone', () => {
  const c = buildCaregiverContext({ parentRole: 'mom', childCount: 2, occupation: 'Product Designer' });
  assert.equal(c.context, 'Mom of 2');
  assert.equal(c.occupation, 'Product Designer');
});

test('both missing leaves only the role line', () => {
  assert.equal(buildCaregiverContext({ parentRole: 'dad', childCount: 1 }).context, 'Dad of 1');
});

test('nothing known renders null rather than a stray separator', () => {
  const c = buildCaregiverContext({});
  assert.equal(c.context, null);
  assert.equal(c.occupation, null);
  assert.equal(c.bio, null);
});

test('whitespace-only values are treated as absent', () => {
  const c = buildCaregiverContext({ neighborhood: '   ', occupation: '  ', bio: '\n' });
  assert.equal(c.context, null);
  assert.equal(c.occupation, null);
  assert.equal(c.bio, null);
});

test('null role with children still reads neutrally — never a guess', () => {
  assert.equal(buildCaregiverContext({ parentRole: null, childCount: 3 }).context, 'Parent of 3');
});

test('area with zero children shows area only, no dangling "of"', () => {
  assert.equal(buildCaregiverContext({ neighborhood: 'Florentin', childCount: 0 }).context, 'Florentin');
});

test('a chosen role with no children still shows, since the user opted in', () => {
  assert.equal(buildCaregiverContext({ parentRole: 'dad', childCount: 0 }).context, 'Dad');
});

test('parentRoleWithCount uses a count, never names', () => {
  assert.equal(parentRoleWithCount('mom', 2), 'Mom of 2');
  assert.equal(parentRoleWithCount('mom', 1), 'Mom of 1');
  assert.equal(parentRoleWithCount(null, 0), 'Parent');
});

test('PRIVACY: no child name, coordinate, email or phone can reach the context line', () => {
  const c = buildCaregiverContext({
    neighborhood: 'Florentin', parentRole: 'mom', childCount: 3,
    occupation: 'Designer', bio: 'Hi',
  });
  const all = JSON.stringify(c);
  assert.ok(!/\d+\.\d{3,}/.test(all), 'coordinates leaked');
  assert.ok(!/@/.test(all), 'email leaked');
  assert.ok(!/\d{4}-\d{2}-\d{2}/.test(all), 'date leaked');
  // Count only — a name list would be more identifying than needed here.
  assert.equal(c.context, 'Mom of 3 · Florentin');
});
