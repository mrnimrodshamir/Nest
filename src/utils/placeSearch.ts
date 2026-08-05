export function normalizePlaceSearchQuery(value: string): string | null {
  const normalized = value.normalize('NFKC').trim().replace(/\s+/g, ' ').slice(0, 100);
  return normalized.length >= 2 ? normalized : null;
}
