/** Reorders joined active-event rows to match the deterministic selection
 * result. SQL row order is not stable, so filtering by a Set would silently
 * discard the ranking promised by the push/digest contract. */
export function rowsInDigestOrder<T extends { occurrence_id: string }>(
  rows: readonly T[],
  selectedOccurrenceIds: readonly string[],
): T[] {
  const byId = new Map(rows.map((row) => [row.occurrence_id, row]));
  return selectedOccurrenceIds.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
}
