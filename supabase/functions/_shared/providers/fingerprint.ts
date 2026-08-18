/** Deterministic content fingerprinting, shared by any provider that needs
 *  one. DigiTel's own copy (supabase/functions/_shared/digitel/connector.ts)
 *  is intentionally left as-is rather than pointed at this file — it is live
 *  and unmodified by this change, per the same reasoning as syncPlan.ts and
 *  the SQL reconciliation function. A THIRD provider reaches for this module
 *  rather than writing a third private copy. */

export function fnv1a64(value: string): string {
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= BigInt(byte);
    hash = BigInt.asUintN(64, hash * 0x100000001b3n);
  }
  return hash.toString(16).padStart(16, '0');
}

/** Same shape as DigiTel's buildOccurrenceIdentityKey: normalized title +
 *  ISO start time + normalized location + coordinates rounded to ~11m. Two
 *  providers computing this the same way over the same real-world event is
 *  also the strongest signal identity.ts's cross-provider classifier looks
 *  for, even though the two are otherwise independent systems. */
export function buildOccurrenceIdentityKey(input: {
  title: string;
  startTime: string;
  locationName: string | null;
  latitude: number;
  longitude: number;
}): string {
  return [
    normalizeIdentityText(input.title),
    new Date(input.startTime).toISOString(),
    normalizeIdentityText(input.locationName ?? ''),
    input.latitude.toFixed(4),
    input.longitude.toFixed(4),
  ].join('|');
}

function normalizeIdentityText(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('he').replace(/[\p{P}\p{S}]+/gu, ' ').replace(/\s+/gu, ' ').trim();
}
