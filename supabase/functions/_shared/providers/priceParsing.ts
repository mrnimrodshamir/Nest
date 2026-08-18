/** Price text, kept as the source's own words rather than parsed into a
 *  number. `events.price_note` is a display string, not a currency column, so
 *  there is nothing to gain from parsing "20 ₪" into 20 and re-formatting it
 *  — and doing so would risk silently mangling a currency this pipeline has
 *  not been told about.
 *
 *  What this DOES decide, conservatively: whether the text is confidently a
 *  price statement at all (a currency symbol or digit is present) versus free
 *  text that happens to be near a price field but is not one — the "price
 *  varies only when the source actually says so" rule from the design brief
 *  means an unparseable string must come back as unknown, not as a guess. */
export interface ParsedPrice {
  priceNote: string | null;
  /** true only when the source EXPLICITLY states the event is free. null —
   *  not false — when nothing about price could be confidently read; "false"
   *  would assert "this costs money," which is exactly the kind of claim
   *  this function must not make without source support. */
  isFree: boolean | null;
}

const UNKNOWN: ParsedPrice = { priceNote: null, isFree: null };

const FREE_PATTERNS = [/כניסה\s*חופשית/, /ללא\s*עלות/, /\bחינם\b/, /free\s*entry/i, /\bfree\b/i];
const PRICE_PREFIX = /^מחיר:\s*/;
const HAS_CURRENCY_SIGNAL = /[\d₪$€]/;

export function parsePriceText(raw: string | null | undefined): ParsedPrice {
  if (!raw) return UNKNOWN;
  const trimmed = raw.replace(PRICE_PREFIX, '').trim();
  if (!trimmed) return UNKNOWN;

  if (FREE_PATTERNS.some((pattern) => pattern.test(trimmed))) {
    return { priceNote: trimmed, isFree: true };
  }
  if (HAS_CURRENCY_SIGNAL.test(trimmed)) {
    return { priceNote: trimmed, isFree: false };
  }
  return UNKNOWN;
}
