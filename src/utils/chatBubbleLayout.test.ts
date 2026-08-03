import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveBubbleRow,
  resolveBubbleTextDirection,
  resolveSenderNameAlignment,
} from './chatBubbleLayout.ts';

test('resolveBubbleRow: an incoming message sits on the LEFT', () => {
  assert.equal(resolveBubbleRow(false).side, 'left');
});

test('resolveBubbleRow: the current user\'s message ALSO sits on the LEFT', () => {
  // This is the regression under test: own messages previously rendered on
  // the right, which is what the device screenshot showed.
  assert.equal(resolveBubbleRow(true).side, 'left');
});

test('resolveBubbleRow: side is identical for own and incoming messages', () => {
  assert.deepEqual(resolveBubbleRow(true), resolveBubbleRow(false));
});

test('resolveBubbleRow: a leading spacer is NEVER rendered — that is what pushed own messages right', () => {
  for (const isMine of [true, false]) {
    assert.equal(resolveBubbleRow(isMine).spacerBefore, false, `isMine=${isMine}`);
  }
});

test('resolveBubbleRow: the trailing spacer is ALWAYS rendered, holding the group left', () => {
  for (const isMine of [true, false]) {
    assert.equal(resolveBubbleRow(isMine).spacerAfter, true, `isMine=${isMine}`);
  }
});

test('resolveBubbleRow: takes no locale input, so a Hebrew device cannot mirror the side', () => {
  assert.equal(resolveBubbleRow.length, 1);
  assert.equal(resolveBubbleRow(true).side, 'left');
});

test('resolveBubbleTextDirection: message text is always left-aligned LTR', () => {
  const dir = resolveBubbleTextDirection();
  assert.equal(dir.textAlign, 'left');
  assert.equal(dir.writingDirection, 'ltr');
});

test('resolveSenderNameAlignment: the "You" label aligns left, exactly like an incoming sender name', () => {
  const mine = resolveSenderNameAlignment(true);
  const theirs = resolveSenderNameAlignment(false);
  assert.equal(mine.alignSelf, 'flex-start');
  assert.equal(mine.textAlign, 'left');
  assert.deepEqual(mine, theirs);
});
