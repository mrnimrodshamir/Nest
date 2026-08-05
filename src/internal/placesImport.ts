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
  cover_image_url?: string | null; gallery_image_urls?: string[] | string | null;
  place_origin?: 'curated' | 'partner' | 'municipality' | string | null;
  partner_tags?: string[] | string | null;
}

export interface ValidatedPlaceImportRow extends Omit<PlaceImportRow, 'category' | 'latitude' | 'longitude'> {
  category: PlaceCategory; latitude: number; longitude: number;
}
export interface ExistingPlaceCandidate { name: string; latitude: number; longitude: number; provider: string | null; providerPlaceId: string | null; }
export interface PlaceImportResult { dryRun: true; validRows: ValidatedPlaceImportRow[]; errors: Array<{ row: number; messages: string[] }>; duplicates: Array<{ row: number; reason: string }>; summary: { total: number; valid: number; invalid: number; duplicates: number; }; }

const BOOLEAN_FIELDS = ['is_indoor','is_outdoor','is_free','stroller_friendly','changing_table','high_chairs','toilets','shade','water_fountain','accessible'] as const;

export function isValidCurationImageUrl(value: string | null | undefined): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch { return false; }
}

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
  if (!isValidCurationImageUrl(row.cover_image_url)) errors.push('cover_image_url must be an HTTPS URL');
  const gallery = Array.isArray(row.gallery_image_urls) ? row.gallery_image_urls : typeof row.gallery_image_urls === 'string' ? row.gallery_image_urls.split('|').filter(Boolean) : [];
  if (gallery.some((url) => !isValidCurationImageUrl(url))) errors.push('gallery_image_urls contains an invalid URL');
  if (row.place_origin != null && !['curated','partner','municipality'].includes(row.place_origin)) errors.push('place_origin is invalid');
  if (errors.length) return { errors };
  const value = { ...row, name: row.name.trim(), category: row.category as PlaceCategory, latitude, longitude } as ValidatedPlaceImportRow;
  for (const field of BOOLEAN_FIELDS) (value as unknown as Record<string, unknown>)[field] = parseBoolean(row[field]);
  value.min_age_months = min; value.max_age_months = max;
  value.gallery_image_urls = gallery.length ? gallery : null;
  value.partner_tags = Array.isArray(row.partner_tags) ? row.partner_tags : typeof row.partner_tags === 'string' ? row.partner_tags.split('|').map((tag) => tag.trim()).filter(Boolean) : null;
  return { value, errors };
}

export function dryRunPlaceImport(rows: PlaceImportRow[], existing: ExistingPlaceCandidate[] = []): PlaceImportResult {
  const validRows: ValidatedPlaceImportRow[] = []; const errors: PlaceImportResult['errors'] = []; const duplicates: PlaceImportResult['duplicates'] = [];
  const providerIds = new Set(existing.flatMap((item) => item.provider && item.providerPlaceId ? [`${item.provider}:${item.providerPlaceId}`] : []));
  const placesByName = new Map<string, ExistingPlaceCandidate[]>();
  for (const item of existing) { const key = item.name.trim().toLocaleLowerCase(); placesByName.set(key, [...(placesByName.get(key) ?? []), item]); }
  rows.forEach((row, index) => {
    const rowNumber = index + 1; const validated = validatePlaceImportRow(row);
    if (!validated.value) { errors.push({ row: rowNumber, messages: validated.errors }); return; }
    const candidate = validated.value;
    const providerKey = candidate.provider && candidate.provider_place_id ? `${candidate.provider}:${candidate.provider_place_id}` : null;
    const providerDuplicate = providerKey ? providerIds.has(providerKey) : false;
    if (providerDuplicate) { duplicates.push({ row: rowNumber, reason: 'provider place ID already exists' }); return; }
    const nameKey = candidate.name.toLocaleLowerCase();
    const nearbyNameDuplicate = (placesByName.get(nameKey) ?? []).some((item) => distanceMeters(candidate, item) <= 50);
    if (nearbyNameDuplicate) { duplicates.push({ row: rowNumber, reason: 'same name within 50 meters' }); return; }
    validRows.push(candidate);
    if (providerKey) providerIds.add(providerKey);
    const indexed = { name: candidate.name, latitude: candidate.latitude, longitude: candidate.longitude, provider: candidate.provider ?? null, providerPlaceId: candidate.provider_place_id ?? null };
    placesByName.set(nameKey, [...(placesByName.get(nameKey) ?? []), indexed]);
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

function csvCell(value: unknown): string {
  const text = Array.isArray(value) ? value.join('|') : value == null ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function exportPlacesJson(rows: PlaceImportRow[]): string {
  return JSON.stringify(rows, null, 2);
}

export function exportPlacesCsv(rows: PlaceImportRow[]): string {
  if (!rows.length) return '';
  const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));
  return [headers.join(','), ...rows.map((row) => headers.map((header) => csvCell((row as unknown as Record<string, unknown>)[header])).join(','))].join('\n');
}
