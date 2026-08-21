import type { GivatayimRawRecord } from './connector.ts';
import type { ProviderCandidate } from '../providers/types.ts';
import { parseHebrewAgeRange } from '../providers/ageParsing.ts';
import { classifyDigitelCategory } from '../digitel/eventMapping.ts';
import { fnv1a64 } from '../providers/fingerprint.ts';

export const GIVATAYIM_PROVIDER_KEY = 'givatayim_municipality';
export const GIVATAYIM_SOURCE_NAME = 'עיריית גבעתיים';
export const GIVATAYIM_PROVIDER_URL = 'https://www.givatayim.muni.il/events/';

export function mapGivatayimRecord(raw: GivatayimRawRecord): ProviderCandidate | null {
  const content = `${raw.title} ${raw.description ?? ''} ${raw.tags.join(' ')}`;
  if (!isFamilyRelevantTagSet(raw.tags, content)) return null;
  const age = parseGivatayimAge(content) ?? parseHebrewAgeRange(content);
  return {
    providerEventId: raw.id, providerTransportId: raw.id, sourceGroupId: null,
    title: raw.title, description: raw.description,
    category: classifyDigitelCategory(content), sourceType: 'municipal', sourceUrl: raw.detailUrl,
    startTime: raw.startsAt, endTime: raw.endsAt, locationName: raw.venue,
    formattedAddress: raw.venue, latitude: raw.latitude, longitude: raw.longitude,
    ageMinMonths: age.ageMinMonths, ageMaxMonths: age.ageMaxMonths, priceNote: raw.priceNote,
    registrationRequired: raw.registrationUrl !== null, registrationUrl: raw.registrationUrl,
    airConditioned: null, indoorOutdoor: null, sourcePublishedAt: null, sourceUpdatedAt: null,
    providerMetadata: { municipalEventId: raw.id, cityId: 'givatayim', tags: raw.tags.join('|'), imageRightsCleared: false },
    occurrenceFingerprint: `givatayim-v1-${fnv1a64(`${raw.id}|${raw.startsAt}`)}`,
  };
}

export function dedupeGivatayimCandidates(candidates: ProviderCandidate[]): { candidates: ProviderCandidate[]; duplicateCount: number } {
  const rows = new Map<string, ProviderCandidate>();
  for (const candidate of [...candidates].sort((a, b) => a.providerEventId.localeCompare(b.providerEventId))) {
    const key = `${normalize(candidate.title)}|${candidate.startTime}|${normalize(candidate.locationName)}`;
    if (!rows.has(key)) rows.set(key, candidate);
  }
  return { candidates: [...rows.values()], duplicateCount: candidates.length - rows.size };
}

function isFamilyRelevantTagSet(tags: string[], content: string): boolean {
  const value = `${tags.join(' ')} ${content}`.toLocaleLowerCase('he');
  if (/מבוגרים|18\+|הגיל השלישי/.test(value) && !/משפחות|לכל המשפחה|הורים וילדים/.test(value)) return false;
  return /משפחות|לכל המשפחה|ילדים|הגיל הרך|לידה עד|זחילה|שנה עד|שנתיים|שלוש עד|ארבע עד|חמש עד|כיתות|פעוט|תינוק|הורים וילדים/.test(value);
}
function parseGivatayimAge(text: string): { ageMinMonths: number | null; ageMaxMonths: number | null } | null {
  const normalized = normalize(text);
  const values: Record<string, number> = { לידה: 0, שנה: 12, שנתיים: 24, שלוש: 36, ארבע: 48, חמש: 60, שש: 72 };
  for (const [from, fromMonths] of Object.entries(values)) {
    for (const [to, toMonths] of Object.entries(values)) {
      if (normalized.includes(`${from} עד ${to}`)) return { ageMinMonths: Math.min(fromMonths, toMonths), ageMaxMonths: Math.max(fromMonths, toMonths) };
    }
  }
  if (/לידה עד זחילה|זחילה עד שנה/.test(normalized)) return { ageMinMonths: 0, ageMaxMonths: 12 };
  return null;
}
function normalize(value: string): string { return value.normalize('NFKC').replace(/[״“”]/g, '"').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim().toLocaleLowerCase('he'); }
