/** Pure address-label formatting, kept free of any network/native import so
 *  it is directly unit-testable. Exists specifically to fix a real device
 *  report: the on-device geocoder's `name` field already includes the street
 *  ("111 Yehuda-Halevi Street"), so naively appending `street` again produced
 *  "111 Yehuda-Halevi Street Yehuda-Halevi Street". */
export function dedupeAddressLabel(name: string | null | undefined, street: string | null | undefined): string | null {
  const trimmedName = name?.trim() || null;
  const trimmedStreet = street?.trim() || null;
  if (trimmedName && trimmedStreet) {
    if (normalizeForComparison(trimmedName).includes(normalizeForComparison(trimmedStreet))) return trimmedName;
    if (normalizeForComparison(trimmedStreet).includes(normalizeForComparison(trimmedName))) return trimmedStreet;
    return `${trimmedName} ${trimmedStreet}`;
  }
  return trimmedName ?? trimmedStreet ?? null;
}

function normalizeForComparison(value: string): string {
  return value.trim().toLowerCase();
}
