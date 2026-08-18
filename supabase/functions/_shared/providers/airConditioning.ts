/** true / false / null — and null is the expected, common answer.
 *
 *  This function exists specifically to be harder to misuse than "just check
 *  if it's a library." A library, museum or mall is not air-conditioned
 *  because of what KIND of venue it is; it is air-conditioned only if a
 *  source states so for THIS event. Deriving it from venue category is a
 *  category error this module refuses to make even when it would usually be
 *  right — "usually right" is exactly how an unsupported claim ships. */
export function parseAirConditioned(raw: string | null | undefined): boolean | null {
  if (!raw) return null;
  if (/ללא\s*מיזוג|לא\s*ממוזג|no\s*air.?condition/i.test(raw)) return false;
  if (/ממוזג|מיזוג\s*אוויר|air.?condition/i.test(raw)) return true;
  return null;
}
