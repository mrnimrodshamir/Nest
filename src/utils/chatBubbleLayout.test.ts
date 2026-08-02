import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveBubbleRow,
  resolveBubbleTextDirection,
  resolveSenderNameAlignment,
} from './chatBubbleLayout.ts';

test('resolveBubbleRow: an incoming message sits on the LEFT', () => {
  const layout = resolveBubbleRow(false);
  assert.equal(layout.side, 'left');
});

test('resolveBubbleRow: the current user\'s message sits on the RIGHT', () => {
  const layout = resolveBubbleRow(true);
  assert.equal(layout.side, 'right');
});

test('resolveBubbleRow: an incoming message is held left by a trailing spacer, never a leading one', () => {
  const layout = resolveBubbleRow(false);
  assert.equal(layout.spacerAfter, true);
  assert.equal(layout.spacerBefore, false);
});

test('resolveBubbleRow: the current user\'s message is pushed right by a leading spacer', () => {
  const layout = resolveBubbleRow(true);
  assert.equal(layout.spacerBefore, true);
  assert.equal(layout.spacerAfter, false);
});

test('resolveBubbleRow: exactly one spacer is ever rendered, so the bubble always has a definite side', () => {
  for (const isMine of [true, false]) {
    const { spacerBefore, spacerAfter } = resolveBubbleRow(isMine);
    assert.equal(
      Number(spacerBefore) + Number(spacerAfter),
      1,
      `expected exactly one spacer for isMine=${isMine}`,
    );
  }
});

test('resolveBubbleRow: side never depends on anything but isMine — no locale input exists', () => {
  // The function takes a single boolean. This is the guarantee: there is no
  // I18nManager / locale parameter that could flip the side on a Hebrew
  // device, which is exactly how the previous alignItems-based layout broke.
  assert.equal(resolveBubbleRow.length, 1);
  assert.equal(resolveBubbleRow(false).side, 'left');
  assert.equal(resolveBubbleRow(false).side, 'left');
});

test('resolveBubbleTextDirection: message text is always left-aligned LTR', () => {
  const dir = resolveBubbleTextDirection();
  assert.equal(dir.textAlign, 'left');
  assert.equal(dir.writingDirection, 'ltr');
});

test('resolveSenderNameAlignment: incoming sender name aligns to the left edge and reads left', () => {
  const name = resolveSenderNameAlignment(false);
  assert.equal(name.alignSelf, 'flex-start');
  assert.equal(name.textAlign, 'left');
});

test('resolveSenderNameAlignment: own sender name follows its bubble to the right edge but still reads left', () => {
  const name = resolveSenderNameAlignment(true);
  assert.equal(name.alignSelf, 'flex-end');
  assert.equal(name.textAlign, 'left');
});
