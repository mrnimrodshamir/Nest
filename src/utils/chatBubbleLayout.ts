/** Chat bubble side/alignment resolution, kept as a pure module so the
 *  RTL behaviour can be asserted in tests without mounting React Native.
 *
 *  WHY THIS EXISTS — the bug it fixes:
 *  The previous implementation set `alignItems: 'flex-start' | 'flex-end'`
 *  on the bubble row and relied on a `direction: 'ltr'` style sitting on an
 *  ancestor SafeAreaView. Both halves of that were unreliable on a real
 *  Hebrew-locale device:
 *
 *    1. `flex-start` / `flex-end` are DIRECTION-RELATIVE in Yoga. When the
 *       native layout direction is RTL, `flex-start` resolves to the RIGHT
 *       edge — so incoming messages rendered on the right.
 *    2. `direction: 'ltr'` on an ancestor is not dependable: it has to
 *       propagate through a third-party native view (react-native-safe-area
 *       -context) to reach the descendant Yoga nodes that actually perform
 *       the alignment.
 *    3. App.tsx's `I18nManager.forceRTL(false)` only takes effect after a
 *       full relaunch, so the very first launch on a Hebrew device still
 *       lays out RTL regardless.
 *
 *  The fix is to stop depending on direction resolution for the side at
 *  all: the row is a `flexDirection: 'row'` with an explicit flexible
 *  spacer placed before or after the bubble column. A spacer that grows is
 *  physically on one side of its sibling regardless of how `flex-start`
 *  would have resolved, and `direction: 'ltr'` is additionally pinned onto
 *  the row node itself (not merely inherited) as a second line of defence.
 */

export type BubbleSide = 'left' | 'right';

export interface BubbleRowLayout {
  /** Which physical edge this bubble sits against. */
  side: BubbleSide;
  /** Render the flexible spacer BEFORE the bubble column (pushes it right). */
  spacerBefore: boolean;
  /** Render the flexible spacer AFTER the bubble column (holds it left). */
  spacerAfter: boolean;
}

/** Incoming messages always sit left; the current user's sit right so the
 *  two remain visually distinguishable. Neither depends on device locale. */
export function resolveBubbleRow(isMine: boolean): BubbleRowLayout {
  const side: BubbleSide = isMine ? 'right' : 'left';
  return {
    side,
    spacerBefore: side === 'right',
    spacerAfter: side === 'left',
  };
}

/** Text inside a bubble is English content and is ALWAYS left-aligned and
 *  LTR, for the current user's messages just as much as for incoming ones.
 *  Returned as a plain object so a test can assert it never varies. */
export function resolveBubbleTextDirection(): {
  textAlign: 'left';
  writingDirection: 'ltr';
} {
  return { textAlign: 'left', writingDirection: 'ltr' };
}

/** The sender name sits above the bubble, aligned to the same physical edge
 *  as the bubble itself, and is always left-aligned internally. */
export function resolveSenderNameAlignment(isMine: boolean): {
  alignSelf: 'flex-start' | 'flex-end';
  textAlign: 'left';
} {
  return { alignSelf: isMine ? 'flex-end' : 'flex-start', textAlign: 'left' };
}
