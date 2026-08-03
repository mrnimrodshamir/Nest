import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatParentSubtitle } from './formatParentSubtitle.ts';

test('0 children: no subtitle, and never "Parent of undefined"', () => {
  assert.equal(formatParentSubtitle([]), undefined);
  assert.equal(formatParentSubtitle(null), undefined);
  assert.equal(formatParentSubtitle(undefined), undefined);
});

test('1 child: natural singular copy', () => {
  assert.equal(formatParentSubtitle([{ name: 'Go' }]), 'Parent of Go');
});

test('2 children: BOTH names are shown — the reported bug showed only the first', () => {
  assert.equal(formatParentSubtitle([{ name: 'Go' }, { name: 'Yo' }]), 'Parent of Go and Yo');
});

test('3 children: concise two-names-plus-remainder format', () => {
  assert.equal(
    formatParentSubtitle([{ name: 'Go' }, { name: 'Yo' }, { name: 'Mia' }]),
    'Parent of Go, Yo +1',
  );
});

test('5 children: remainder count scales', () => {
  const kids = ['Go', 'Yo', 'Mia', 'Ari', 'Tal'].map((name) => ({ name }));
  assert.equal(formatParentSubtitle(kids), 'Parent of Go, Yo +3');
});

test('renaming a child is reflected immediately', () => {
  const before = formatParentSubtitle([{ name: 'Go' }, { name: 'Yo' }]);
  const after = formatParentSubtitle([{ name: 'Gil' }, { name: 'Yo' }]);
  assert.equal(before, 'Parent of Go and Yo');
  assert.equal(after, 'Parent of Gil and Yo');
});

test('deleting a child falls back to the singular form', () => {
  assert.equal(formatParentSubtitle([{ name: 'Go' }, { name: 'Yo' }]), 'Parent of Go and Yo');
  assert.equal(formatParentSubtitle([{ name: 'Yo' }]), 'Parent of Yo');
});

test('changing the default child does not change the subtitle — order and content drive it', () => {
  // The default child is a matching concern, not an identity concern. Same
  // list, same copy, regardless of which entry is flagged default.
  const list = [{ name: 'Go', isDefault: false }, { name: 'Yo', isDefault: true }];
  const flipped = [{ name: 'Go', isDefault: true }, { name: 'Yo', isDefault: false }];
  assert.equal(formatParentSubtitle(list), formatParentSubtitle(flipped));
  assert.equal(formatParentSubtitle(list), 'Parent of Go and Yo');
});

test('never collapses to a bare count — every rendered subtitle names at least one child', () => {
  for (let n = 1; n <= 6; n++) {
    const kids = Array.from({ length: n }, (_, i) => ({ name: `Kid${i}` }));
    const out = formatParentSubtitle(kids);
    assert.ok(out?.includes('Kid0'), `n=${n} should name the first child, got ${out}`);
  }
});

test('blank/whitespace names are skipped rather than rendering an empty slot', () => {
  assert.equal(formatParentSubtitle([{ name: 'Go' }, { name: '  ' }]), 'Parent of Go');
  assert.equal(formatParentSubtitle([{ name: '' }]), undefined);
});
