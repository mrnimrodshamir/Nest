import type { AppLocale } from './core';
import { isRtlLocale } from './core';

/** Hebrew, Arabic, and the Hebrew/Arabic presentation-form blocks. */
const RTL_CHAR = /[֐-׿؀-ۿ܀-ݏיִ-﷿ﹰ-﻿]/;
/** Strong left-to-right letters.
 *
 *  Latin (basic, Latin-1, Latin Extended-A/B and IPA), Greek, and Cyrillic.
 *
 *  Cyrillic was missing until Russian shipped, and its absence was not inert:
 *  a script that matches NEITHER pattern is reported as direction-neutral, so
 *  detectTextDirection returned null and the caller fell back to the UI locale.
 *  A Russian bio therefore rendered right-aligned to a Hebrew viewer. Any
 *  strongly-directional script the app ships must appear in one of these two
 *  patterns or it inherits the reader's direction instead of its own. */
const LTR_CHAR = /[A-Za-zÀ-ʯΆ-ώЀ-ӿ]/;

export type TextDirection = 'ltr' | 'rtl';

/** Direction of a *user-generated* string, judged by which script appears
 *  first. Venue names in Tel Aviv are routinely mixed ("Cafe Xoho תל אביב"),
 *  and the first strong character is what the Unicode bidi algorithm itself
 *  uses to pick a paragraph direction — matching it keeps our rendering
 *  consistent with the platform's. Returns null when the string carries no
 *  directional signal at all (digits, punctuation, emoji). */
export function detectTextDirection(text: string | null | undefined): TextDirection | null {
  if (!text) return null;
  for (const char of text) {
    if (RTL_CHAR.test(char)) return 'rtl';
    if (LTR_CHAR.test(char)) return 'ltr';
  }
  return null;
}

/** Alignment for user-generated content: follow the content's own script, and
 *  fall back to the UI locale when the content is direction-neutral.
 *
 *  This is why a Hebrew UI does not force English venue names to render
 *  right-aligned and reversed, and vice versa. */
export function textAlignForContent(
  text: string | null | undefined,
  locale: AppLocale,
): { textAlign: 'left' | 'right'; writingDirection: TextDirection } {
  const direction = detectTextDirection(text) ?? (isRtlLocale(locale) ? 'rtl' : 'ltr');
  return { textAlign: direction === 'rtl' ? 'right' : 'left', writingDirection: direction };
}

const FIRST_STRONG_ISOLATE = '⁨';
const POP_DIRECTIONAL_ISOLATE = '⁩';

/** Wraps a run of user-generated text in a Unicode isolate so it cannot
 *  reorder the surrounding sentence.
 *
 *  Without this, "Cafe Xoho" interpolated into a Hebrew sentence can drag
 *  adjacent punctuation to the wrong end of the line — the classic
 *  "בואו ל-Cafe Xoho!" where the "!" jumps to the front. FSI lets the renderer
 *  pick the run's direction from its own first strong character and PDI
 *  restores the outer context. */
export function isolateText(text: string | null | undefined): string {
  if (!text) return '';
  return `${FIRST_STRONG_ISOLATE}${text}${POP_DIRECTIONAL_ISOLATE}`;
}

/** True when the string mixes both scripts and therefore needs isolating. */
export function isBidirectional(text: string | null | undefined): boolean {
  if (!text) return false;
  return RTL_CHAR.test(text) && LTR_CHAR.test(text);
}

/** Maps a logical start/end onto a physical left/right for the given locale.
 *
 *  Prefer real `flex-start`/`flex-end` and `marginStart`/`marginEnd` in
 *  stylesheets; this exists for the cases where a physical value is
 *  unavoidable, such as an icon that must visually point "forward". */
export function physicalEdge(edge: 'start' | 'end', locale: AppLocale): 'left' | 'right' {
  const rtl = isRtlLocale(locale);
  if (edge === 'start') return rtl ? 'right' : 'left';
  return rtl ? 'left' : 'right';
}

/** Chevrons and back arrows must point *back*, which flips with the locale.
 *  Icons that are not directional (a map pin, a heart) must never be passed
 *  through here. */
export function directionalIconRotation(locale: AppLocale): 0 | 180 {
  return isRtlLocale(locale) ? 180 : 0;
}
