import { isPlaceCategory, type PlaceCategory } from '@/types/familyFriendlyPlace';
import { distanceMeters } from '@/utils/placeViewport';

export interface PlaceImportRow {
  name: string; category: string; latitude: number | string; longitude: number | string;
  formatted_address?: string | null; neighborhood?: string | null; short_description?: string | null;
  is_indoor?: boolean | string | null; is_outdoor?: boolean | string | null; is_free?: boolean | string | null;
  min_age_months?: number | string | null; max_age_months?: number | string | null;
  stroller_friendly?: boolean | string | null; changing_table?: boolean | string | null;
  high_chairs?: boolean | string | null; toilets?: boolean | string | null; shade?: boolean | string | null;
  water_fountain?: boolean | string | null; accessible?: boolean | string | null;
  website_url?: string | null; source_name?: string | null; source_url?: string | null;
  provider?: string | null; provider_place_id?: string | null;
}

export interface ValidatedPlaceImportRow extends Omit<PlaceImportRow, 'category' | 'latitude' | 'longitude'> {
  category: PlaceCategory; latitude: number; longitude: number;
}
export interface ExistingPlaceCandidate { name: string; latitude: number; longitude: number; provider: string | null; providerPlaceId: string | null; }
export interface PlaceImportResult { dryRun: true; validRows: ValidatedPlaceImportRow[]; errors: Array<{ row: number; messages: string[] }>; duplicates: Array<{ row: number; reason: string }>; summary: { total: number; valid: number; invalid: number; duplicates: number; }; }

const BOOLEAN_FIELDS = ['is_indoor','is_outdoor','is_free','stroller_friendly','changing_table','high_chairs','toilets','shade','water_fountain','accessible'] as const;

function parseBoolean(value: unknown): boolean | null | undefined {
  if (value === '' || value == null) return value == null ? null : undefined;
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return undefined;
}

export function validatePlaceImportRow(row: PlaceImportRow): { value?: ValidatedPlaceImportRow; errors: string[] } {
  const errors: string[] = [];
  const latitude = Number(row.latitude); const longitude = Number(row.longitude);
  if (!row.name?.trim()) errors.push('name is required');
  if (!isPlaceCategory(row.category)) errors.push('category is not approved');
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) errors.push('latitude is invalid');
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) errors.push('longitude is invalid');
  for (const field of BOOLEAN_FIELDS) if (row[field] != null && row[field] !== '' && parseBoolean(row[field]) === undefined) errors.push(`${field} must be true, false, 1, or 0`);
  const min = row.min_age_months == null || row.min_age_months === '' ? null : Number(row.min_age_months);
  const max = row.max_age_months == null || row.max_age_months === '' ? null : Number(row.max_age_months);
  if (min != null && (!Number.isInteger(min) || min < 0)) errors.push('min_age_months is invalid');
  if (max != null && (!Number.isInteger(max) || max < 0)) errors.push('max_age_months is invalid');
  if (min != null && max != null && min > max) errors.push('minimum age exceeds maximum age');
  if (errors.length) return { errors };
  const value = { ...row, name: row.name.trim(), category: row.category as PlaceCategory, latitude, longitude } as ValidatedPlaceImportRow;
  for (const field of BOOLEAN_FIELDS) (value as unknown as Record<string, unknown>)[field] = parseBoolean(row[field]);
  value.min_age_months = min; value.max_age_months = max;
  return { value, errors };
}

export function dryRunPlaceImport(rows: PlaceImportRow[], existing: ExistingPlaceCandidate[] = []): PlaceImportResult {
  const validRows: ValidatedPlaceImportRow[] = []; const errors: PlaceImportResult['errors'] = []; const duplicates: PlaceImportResult['duplicates'] = [];
  rows.forEach((row, index) => {
    const rowNumber = index + 1; const validated = validatePlaceImportRow(row);
    if (!validated.value) { errors.push({ row: rowNumber, messages: validated.errors }); return; }
    const candidate = validated.value;
    const prior = [...existing, ...validRows.map((item) => ({ name: item.name, latitude: item.latitude, longitude: item.longitude, provider: item.provider ?? null, providerPlaceId: item.provider_place_id ?? null }))];
    const providerDuplicate = candidate.provider && candidate.provider_place_id && prior.some((item) => item.provider === candidate.provider && item.providerPlaceId === candidate.provider_place_id);
    if (providerDuplicate) { duplicates.push({ row: rowNumber, reason: 'provider place ID already exists' }); return; }
    const nearbyNameDuplicate = prior.some((item) => item.name.trim().toLocaleLowerCase() === candidate.name.toLocaleLowerCase() && distanceMeters(candidate, item) <= 50);
    if (nearbyNameDuplicate) { duplicates.push({ row: rowNumber, reason: 'same name within 50 meters' }); return; }
    validRows.push(candidate);
  });
  return { dryRun: true, validRows, errors, duplicates, summary: { total: rows.length, valid: validRows.length, invalid: errors.length, duplicates: duplicates.length } };
}

export function parsePlacesCsv(csv: string): PlaceImportRow[] {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const parseLine = (line: string) => { const values: string[] = []; let value = ''; let quoted = false; for (let i = 0; i < line.length; i++) { const char = line[i]; if (char === '"' && quoted && line[i + 1] === '"') { value += '"'; i++; } else if (char === '"') quoted = !quoted; else if (char === ',' && !quoted) { values.push(value); value = ''; } else value += char; } values.push(value); return values; };
  const headers = parseLine(lines[0]);
  return lines.slice(1).map((line) => Object.fromEntries(headers.map((header, i) => [header, parseLine(line)[i] ?? ''])) as unknown as PlaceImportRow);
}
