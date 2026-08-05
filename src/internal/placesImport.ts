import { isPlaceCategory, type PlaceCategory, type PlaceVerificationStatus } from '@/types/familyFriendlyPlace';
import { distanceMeters } from '@/utils/placeViewport';

export const PLACE_IMPORT_REQUIRED_FIELDS = [
  'name','category','latitude','longitude','formatted_address','neighborhood','short_description',
  'is_indoor','is_outdoor','is_free','price_note','min_age_months','max_age_months','stroller_friendly',
  'changing_table','toilets','shade','water_fountain','accessible','website_url','source_name','source_url',
  'verification_status','last_verified_at',
] as const;

export interface PlaceImportRow {
  name: string; category: string; latitude: number | string; longitude: number | string;
  formatted_address?: string | null; neighborhood?: string | null; short_description?: string | null; full_description?: string | null;
  is_indoor?: boolean | string | null; is_outdoor?: boolean | string | null; is_free?: boolean | string | null; price_note?: string | null;
  min_age_months?: number | string | null; max_age_months?: number | string | null;
  stroller_friendly?: boolean | string | null; changing_table?: boolean | string | null;
  high_chairs?: boolean | string | null; toilets?: boolean | string | null; shade?: boolean | string | null;
  water_fountain?: boolean | string | null; accessible?: boolean | string | null;
  website_url?: string | null; source_name?: string | null; source_url?: string | null;
  verification_status?: string | null; last_verified_at?: string | null;
  external_id?: string | null; provider?: string | null; provider_place_id?: string | null; slug?: string | null;
  cover_image_url?: string | null; gallery_image_urls?: string[] | string | null;
  place_origin?: 'curated' | 'partner' | 'municipality' | string | null; partner_tags?: string[] | string | null;
}

export interface ValidatedPlaceImportRow extends Omit<PlaceImportRow, 'category' | 'latitude' | 'longitude' | 'verification_status'> {
  category: PlaceCategory; latitude: number; longitude: number; slug: string; verification_status: PlaceVerificationStatus;
}

export interface ExistingPlaceCandidate {
  id?: string; name: string; slug?: string | null; latitude: number; longitude: number;
  sourceName?: string | null; externalId?: string | null; provider: string | null; providerPlaceId: string | null;
}

export type DuplicateKind = 'exact_source_id' | 'exact_provider_id' | 'normalized_name_nearby' | 'slug_collision';
export interface DuplicateCandidate { row: number; kind: DuplicateKind; candidateId: string | null; reason: string; distanceMeters?: number; }
export interface ManualReviewCandidate { row: number; candidateId: string | null; reason: string; distanceMeters: number; }
export interface PlaceUpsertPlanItem { row: number; operation: 'insert' | 'update'; targetId: string | null; record: ValidatedPlaceImportRow; }
export interface PlaceImportRowResult { row: number; status: 'PASS' | 'FAIL' | 'REVIEW'; errors: string[]; missingCriticalFields: string[]; duplicateCandidates: DuplicateCandidate[]; }
export interface PlaceImportResult {
  dryRun: true;
  validRows: ValidatedPlaceImportRow[];
  errors: Array<{ row: number; messages: string[] }>;
  duplicates: DuplicateCandidate[];
  manualReview: ManualReviewCandidate[];
  upserts: PlaceUpsertPlanItem[];
  rows: PlaceImportRowResult[];
  categoryTotals: Record<string, number>;
  neighborhoodTotals: Record<string, number>;
  summary: { total: number; passed: number; failed: number; review: number; inserts: number; updates: number; duplicates: number; };
}

const BOOLEAN_FIELDS = ['is_indoor','is_outdoor','is_free','stroller_friendly','changing_table','high_chairs','toilets','shade','water_fountain','accessible'] as const;
const VERIFICATION_STATUSES = ['draft','verified','needs_review','archived'] as const;

export function normalizePlaceName(value: string): string {
  return value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
}

export function createPlaceSlug(value: string): string {
  const slug = value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return slug || `place-${simpleHash(value)}`;
}

function simpleHash(value: string): string {
  let hash = 2166136261;
  for (const char of value) hash = Math.imul(hash ^ char.codePointAt(0)!, 16777619);
  return (hash >>> 0).toString(36);
}

export function isValidCurationUrl(value: string | null | undefined): boolean {
  if (!value) return true;
  try { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password; } catch { return false; }
}
export const isValidCurationImageUrl = isValidCurationUrl;

function parseBoolean(value: unknown): boolean | null | undefined {
  if (value === '' || value == null) return null;
  if (value === true || value === 'true' || value === '1') return true;
  if (value === false || value === 'false' || value === '0') return false;
  return undefined;
}

function missingContractFields(row: PlaceImportRow): string[] {
  const record = row as unknown as Record<string, unknown>;
  return PLACE_IMPORT_REQUIRED_FIELDS.filter((field) => !Object.prototype.hasOwnProperty.call(record, field));
}

export function validatePlaceImportRow(row: PlaceImportRow): { value?: ValidatedPlaceImportRow; errors: string[]; missingCriticalFields: string[] } {
  const errors: string[] = [];
  const missingCriticalFields = missingContractFields(row);
  if (missingCriticalFields.length) errors.push(...missingCriticalFields.map((field) => `${field} is required; use null when unknown`));
  const latitude = row.latitude == null || row.latitude === '' ? Number.NaN : Number(row.latitude);
  const longitude = row.longitude == null || row.longitude === '' ? Number.NaN : Number(row.longitude);
  if (!row.name?.trim()) errors.push('name is required');
  if (!isPlaceCategory(row.category)) errors.push('category is not approved');
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) errors.push('latitude is invalid');
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) errors.push('longitude is invalid');
  for (const field of BOOLEAN_FIELDS) if (row[field] != null && row[field] !== '' && parseBoolean(row[field]) === undefined) errors.push(`${field} must be true, false, 1, 0, or null`);
  const min = row.min_age_months == null || row.min_age_months === '' ? null : Number(row.min_age_months);
  const max = row.max_age_months == null || row.max_age_months === '' ? null : Number(row.max_age_months);
  if (min != null && (!Number.isInteger(min) || min < 0)) errors.push('min_age_months is invalid');
  if (max != null && (!Number.isInteger(max) || max < 0)) errors.push('max_age_months is invalid');
  if (min != null && max != null && min > max) errors.push('minimum age exceeds maximum age');
  if (!isValidCurationUrl(row.website_url)) errors.push('website_url must be an HTTPS URL or null');
  if (!isValidCurationUrl(row.source_url)) errors.push('source_url must be an HTTPS URL or null');
  if (!isValidCurationImageUrl(row.cover_image_url)) errors.push('cover_image_url must be an HTTPS URL or null');
  const gallery = Array.isArray(row.gallery_image_urls) ? row.gallery_image_urls : typeof row.gallery_image_urls === 'string' ? row.gallery_image_urls.split('|').map((url) => url.trim()).filter(Boolean) : [];
  if (gallery.some((url) => !isValidCurationImageUrl(url))) errors.push('gallery_image_urls contains an invalid URL');
  if (row.place_origin != null && !['curated','partner','municipality'].includes(row.place_origin)) errors.push('place_origin is invalid');
  if (!VERIFICATION_STATUSES.includes(row.verification_status as PlaceVerificationStatus)) errors.push('verification_status is invalid');
  if (row.last_verified_at && Number.isNaN(Date.parse(row.last_verified_at))) errors.push('last_verified_at must be an ISO date-time or null');
  if (!row.name?.trim()) missingCriticalFields.push('name');
  if (!row.category) missingCriticalFields.push('category');
  if (!Number.isFinite(latitude)) missingCriticalFields.push('latitude');
  if (!Number.isFinite(longitude)) missingCriticalFields.push('longitude');
  const uniqueMissing = [...new Set(missingCriticalFields)];
  if (errors.length) return { errors: [...new Set(errors)], missingCriticalFields: uniqueMissing };
  const value = { ...row, name: row.name.trim(), category: row.category as PlaceCategory, latitude, longitude,
    slug: row.slug?.trim() || createPlaceSlug(row.name), verification_status: row.verification_status as PlaceVerificationStatus } as ValidatedPlaceImportRow;
  for (const field of BOOLEAN_FIELDS) (value as unknown as Record<string, unknown>)[field] = parseBoolean(row[field]);
  value.min_age_months = min; value.max_age_months = max; value.gallery_image_urls = gallery.length ? gallery : null;
  value.partner_tags = Array.isArray(row.partner_tags) ? row.partner_tags : typeof row.partner_tags === 'string' ? row.partner_tags.split('|').map((tag) => tag.trim()).filter(Boolean) : null;
  return { value, errors: [], missingCriticalFields: uniqueMissing };
}

export function dryRunPlaceImport(rows: PlaceImportRow[], existing: ExistingPlaceCandidate[] = []): PlaceImportResult {
  const validRows: ValidatedPlaceImportRow[] = []; const errors: PlaceImportResult['errors'] = [];
  const duplicates: DuplicateCandidate[] = []; const manualReview: ManualReviewCandidate[] = []; const upserts: PlaceUpsertPlanItem[] = []; const rowResults: PlaceImportRowResult[] = [];
  const allCandidates: ExistingPlaceCandidate[] = [...existing];
  const categoryTotals: Record<string, number> = {}; const neighborhoodTotals: Record<string, number> = {};

  rows.forEach((row, index) => {
    const rowNumber = index + 1; const validated = validatePlaceImportRow(row);
    if (!validated.value) {
      errors.push({ row: rowNumber, messages: validated.errors });
      rowResults.push({ row: rowNumber, status: 'FAIL', errors: validated.errors, missingCriticalFields: validated.missingCriticalFields, duplicateCandidates: [] });
      return;
    }
    const candidate = validated.value; validRows.push(candidate);
    categoryTotals[candidate.category] = (categoryTotals[candidate.category] ?? 0) + 1;
    const neighborhood = candidate.neighborhood?.trim() || '(unknown)'; neighborhoodTotals[neighborhood] = (neighborhoodTotals[neighborhood] ?? 0) + 1;
    const matches: DuplicateCandidate[] = [];
    const exactSource = candidate.source_name && candidate.external_id ? allCandidates.find((item) => item.sourceName === candidate.source_name && item.externalId === candidate.external_id) : undefined;
    if (exactSource) matches.push({ row: rowNumber, kind: 'exact_source_id', candidateId: exactSource.id ?? null, reason: 'same source_name + external_id' });
    const exactProvider = !exactSource && candidate.provider && candidate.provider_place_id ? allCandidates.find((item) => item.provider === candidate.provider && item.providerPlaceId === candidate.provider_place_id) : undefined;
    if (exactProvider) matches.push({ row: rowNumber, kind: 'exact_provider_id', candidateId: exactProvider.id ?? null, reason: 'same provider + provider_place_id' });
    const normalizedName = normalizePlaceName(candidate.name);
    const namedNearby = allCandidates.map((item) => ({ item, distance: distanceMeters(candidate, item) })).find(({ item, distance }) => normalizePlaceName(item.name) === normalizedName && distance <= 50);
    if (!exactSource && !exactProvider && namedNearby) matches.push({ row: rowNumber, kind: 'normalized_name_nearby', candidateId: namedNearby.item.id ?? null, reason: 'normalized name within 50 meters', distanceMeters: Math.round(namedNearby.distance) });
    const slugMatch = allCandidates.find((item) => item.slug === candidate.slug);
    if (!exactSource && !exactProvider && !namedNearby && slugMatch) matches.push({ row: rowNumber, kind: 'slug_collision', candidateId: slugMatch.id ?? null, reason: `slug collision: ${candidate.slug}` });
    duplicates.push(...matches);

    const uncertain = !matches.length ? allCandidates.map((item) => ({ item, distance: distanceMeters(candidate, item) })).find(({ item, distance }) => (normalizePlaceName(item.name) === normalizedName && distance <= 250) || distance <= 30) : undefined;
    if (uncertain) manualReview.push({ row: rowNumber, candidateId: uncertain.item.id ?? null, reason: normalizePlaceName(uncertain.item.name) === normalizedName ? 'same normalized name within 250 meters' : 'different name within 30 meters', distanceMeters: Math.round(uncertain.distance) });

    const identity = exactSource ?? exactProvider;
    const identityIsInputRow = identity?.id?.startsWith('input-row-') === true;
    const requiresReview = Boolean(identityIsInputRow || (matches.length && !identity) || uncertain);
    if (!requiresReview) upserts.push({ row: rowNumber, operation: identity ? 'update' : 'insert', targetId: identity?.id ?? null, record: candidate });
    rowResults.push({ row: rowNumber, status: requiresReview ? 'REVIEW' : 'PASS', errors: [], missingCriticalFields: [], duplicateCandidates: matches });
    allCandidates.push({ id: `input-row-${rowNumber}`, name: candidate.name, slug: candidate.slug, latitude: candidate.latitude, longitude: candidate.longitude, sourceName: candidate.source_name ?? null, externalId: candidate.external_id ?? null, provider: candidate.provider ?? null, providerPlaceId: candidate.provider_place_id ?? null });
  });

  const passed = rowResults.filter((row) => row.status === 'PASS').length; const failed = rowResults.filter((row) => row.status === 'FAIL').length; const review = rowResults.filter((row) => row.status === 'REVIEW').length;
  return { dryRun: true, validRows, errors, duplicates, manualReview, upserts, rows: rowResults, categoryTotals, neighborhoodTotals,
    summary: { total: rows.length, passed, failed, review, inserts: upserts.filter((item) => item.operation === 'insert').length, updates: upserts.filter((item) => item.operation === 'update').length, duplicates: duplicates.length } };
}

export function parsePlacesCsv(csv: string): PlaceImportRow[] {
  const lines = csv.replace(/^\uFEFF/, '').split(/\r?\n/).filter((line) => line.trim()); if (lines.length < 2) return [];
  const parseLine = (line: string) => { const values: string[] = []; let value = ''; let quoted = false; for (let i = 0; i < line.length; i++) { const char = line[i]; if (char === '"' && quoted && line[i + 1] === '"') { value += '"'; i++; } else if (char === '"') quoted = !quoted; else if (char === ',' && !quoted) { values.push(value); value = ''; } else value += char; } values.push(value); return values; };
  const headers = parseLine(lines[0]); return lines.slice(1).map((line) => { const values = parseLine(line); return Object.fromEntries(headers.map((header, i) => [header, values[i] === '' ? null : values[i] ?? null])) as unknown as PlaceImportRow; });
}

function csvCell(value: unknown): string { const text = Array.isArray(value) ? value.join('|') : value == null ? '' : String(value); return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text; }
export function exportPlacesJson(rows: PlaceImportRow[]): string { return JSON.stringify(rows, null, 2); }
export function exportPlacesCsv(rows: PlaceImportRow[]): string { if (!rows.length) return ''; const headers = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))); return [headers.join(','), ...rows.map((row) => headers.map((header) => csvCell((row as unknown as Record<string, unknown>)[header])).join(','))].join('\n'); }
