/** Chat bubble side/alignment resolution, kept as a pure module so the
 *  RTL behaviour can be asserted in tests without mounting React Native.
 *
 *  PRODUCT RULE: every message row — incoming AND the current user's — is
 *  left-positioned. The current user's messages are distinguished by bubble
 *  COLOUR ONLY, never by side. A chat that mixes sides reads as mirrored on
 *  a Hebrew-locale device and was the source of two rounds of device bugs.
 *
 *  WHY THE SIDE IS STRUCTURAL RATHER THAN `alignItems`:
 *  `flex-start` / `flex-end` and `alignSelf` are DIRECTION-RELATIVE in
 *  Yoga — when the native layout direction is RTL, `flex-start` resolves to
 *  the RIGHT edge. Neither `direction: 'ltr'` on an ancestor nor
 *  `I18nManager.forceRTL(false)` is dependable here: the former has to
 *  propagate through a third-party native view to reach the descendant
 *  nodes doing the alignment, and the latter only applies from the NEXT
 *  launch, so a first run on a Hebrew device still lays out RTL.
 *
 *  So the position is decided by a flexible spacer rendered AFTER the
 *  bubble group. A spacer that grows physically occupies the remaining
 *  space to one side of its sibling regardless of how `flex-start` would
 *  have resolved — it cannot be mirrored.
 */

export type BubbleSide = 'left';

export interface BubbleRowLayout {
  /** Always 'left'. Kept explicit so a regression to sided layout fails a test. */
  side: BubbleSide;
  /** Never render a leading spacer — that is what pushed own messages right. */
  spacerBefore: false;
  /** Always render the trailing spacer; it is what holds the group left. */
  spacerAfter: true;
}

/** Both incoming and outgoing messages resolve to the same left position.
 *  `isMine` is accepted so call sites read naturally and so the test suite
 *  can assert the side does NOT vary with it. */
export function resolveBubbleRow(_isMine: boolean): BubbleRowLayout {
  return { side: 'left', spacerBefore: false, spacerAfter: true };
}

/** Message text follows its own first strong script, independently of both
 * the app locale and the bubble's deliberately stable physical side. */
export function resolveBubbleTextDirection(
  content: string,
  locale: AppLocale,
): { textAlign: 'left' | 'right'; writingDirection: 'ltr' | 'rtl' } {
  return textAlignForContent(content, locale);
}

/** The sender name (including the "You" label) sits above the bubble on the
 *  left for every message, matching the bubble group it labels. */
export function resolveSenderNameAlignment(_isMine: boolean): {
  alignSelf: 'flex-start';
  textAlign: 'left';
} {
  return { alignSelf: 'flex-start', textAlign: 'left' };
}
import type { AppLocale } from '../i18n/core.ts';
import { textAlignForContent } from '../i18n/rtl.ts';
