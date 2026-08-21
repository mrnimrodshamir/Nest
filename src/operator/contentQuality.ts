import type { ContentCandidate, OperatorFinding } from './types.ts';

export interface ContentAuditResult {
  checked: number;
  issues: OperatorFinding[];
  counts: Record<string, number>;
  duplicateGroups: string[][];
  examples: Record<string, string[]>;
}

export interface ContentAuditOptions { resolveCity?: (latitude: number, longitude: number) => string | null; brokenUrls?: ReadonlySet<string> }

export function auditContent(rows: ContentCandidate[], now = new Date(), options: ContentAuditOptions = {}): ContentAuditResult {
  const counts: Record<string, number> = { missingAge: 0, missingPrice: 0, missingLocation: 0, missingUrl: 0, brokenUrl: 0, badDate: 0, pastVisible: 0, cancelledVisible: 0, cancellationMismatch: 0, suspiciousAdultOnly: 0, implausiblePrice: 0, wrongCity: 0, categoryAnomaly: 0, duplicateGroups: 0 };
  const issues: OperatorFinding[] = [];
  const examples: Record<string, string[]> = {};
  const flag = (key: string, row: ContentCandidate) => { counts[key]++; if ((examples[key]?.length ?? 0) < 5) examples[key] = [...(examples[key] ?? []), `${row.id}: ${row.title}`]; };
  for (const row of rows) {
    if (row.ageMinMonths == null && row.ageMaxMonths == null) flag('missingAge',row);
    if (!row.priceNote) flag('missingPrice',row);
    if (!validCoordinate(row.latitude, row.longitude)) flag('missingLocation',row);
    if (!safeUrl(row.sourceUrl) && !safeUrl(row.registrationUrl)) flag('missingUrl',row);
    if ((row.sourceUrl && options.brokenUrls?.has(row.sourceUrl)) || (row.registrationUrl && options.brokenUrls?.has(row.registrationUrl))) flag('brokenUrl',row);
    const starts = Date.parse(row.startsAt);
    if (!Number.isFinite(starts)) flag('badDate',row);
    else if ((Number.isFinite(Date.parse(row.endsAt ?? '')) ? Date.parse(row.endsAt!) : starts) < now.getTime()) flag('pastVisible',row);
    if (row.eventStatus === 'cancelled') flag('cancelledVisible',row);
    if (/(?:בוטל|מבוטל|cancelled|canceled)/i.test(row.title) && row.eventStatus !== 'cancelled') flag('cancellationMismatch',row);
    if (/(?:18\+|למבוגרים|adult(?:s|-only)?)/i.test(`${row.title} ${row.description ?? ''}`) && !/(?:ילד|משפח|נוער|parent|child|family|youth)/i.test(`${row.title} ${row.description ?? ''}`)) flag('suspiciousAdultOnly',row);
    if (row.priceNote && Math.max(...[...row.priceNote.matchAll(/\d+(?:[.,]\d+)?/g)].map((match) => Number(match[0].replace(',','.'))),0) > 1000) flag('implausiblePrice',row);
    if (validCoordinate(row.latitude,row.longitude) && options.resolveCity) {
      const resolvedCity = options.resolveCity(row.latitude!,row.longitude!);
      if (resolvedCity != null && resolvedCity !== row.cityId) flag('wrongCity',row);
    }
    if (!row.category || row.category === 'other') flag('categoryAnomaly',row);
  }
  const duplicateGroups = findDuplicates(rows);
  counts.duplicateGroups = duplicateGroups.length;
  addIssue(issues, counts.badDate, 'bad-date', 'P0', 'Visible Events contain invalid dates');
  addIssue(issues, counts.pastVisible, 'past-visible', 'P0', 'Finished Events remain in the active view');
  addIssue(issues, counts.cancelledVisible, 'cancelled-visible', 'P1', 'Cancelled Events remain publicly active');
  addIssue(issues, counts.cancellationMismatch, 'cancellation-mismatch', 'P1', 'Cancellation wording disagrees with Event lifecycle');
  addIssue(issues, counts.suspiciousAdultOnly, 'adult-only', 'P1', 'Potential adult-only content is publicly active');
  addIssue(issues, counts.wrongCity, 'wrong-city', 'P1', 'Event coordinates conflict with assigned city');
  addIssue(issues, counts.brokenUrl, 'broken-url', 'P1', 'Event source or registration URLs are unreachable');
  addIssue(issues, counts.implausiblePrice, 'implausible-price', 'P2', 'Event price metadata is implausible');
  addIssue(issues, duplicateGroups.length, 'duplicates', 'P1', 'Probable duplicate Event occurrences detected');
  addIssue(issues, counts.missingLocation, 'missing-location', 'P1', 'Events are missing valid coordinates');
  addIssue(issues, counts.missingUrl, 'missing-url', 'P2', 'Events have no safe source or registration URL');
  addIssue(issues, counts.missingAge, 'missing-age', 'P2', 'Events have no age metadata');
  addIssue(issues, counts.missingPrice, 'missing-price', 'P3', 'Events have no price metadata');
  addIssue(issues, counts.categoryAnomaly, 'category', 'P2', 'Events use missing or generic categories');
  return { checked: rows.length, issues, counts, duplicateGroups, examples };
}

function findDuplicates(rows: ContentCandidate[]): string[][] {
  const groups = new Map<string, string[]>();
  for (const row of rows) {
    const time = Number.isFinite(Date.parse(row.startsAt)) ? new Date(row.startsAt).toISOString().slice(0, 16) : row.startsAt;
    const key = `${normalize(row.title)}|${time}|${round(row.latitude)}|${round(row.longitude)}`;
    groups.set(key, [...(groups.get(key) ?? []), row.id]);
  }
  return [...groups.values()].filter((ids) => ids.length > 1);
}

function addIssue(target: OperatorFinding[], count: number, id: string, priority: OperatorFinding['priority'], title: string): void {
  if (!count) return;
  target.push({ id: `content:${id}`, domain: 'content', priority, title, evidence: `${count} affected active occurrence(s)`, severity: priority === 'P0' ? 10 : priority === 'P1' ? 8 : 5, userImpact: 7, confidence: 9, reach: Math.min(10, 3 + count / 20), implementationRisk: 4, autonomy: 'YELLOW' });
}
function normalize(value: string): string { return value.normalize('NFKC').toLocaleLowerCase('he').replace(/[״“”'".,:;!?()\[\]{}–—-]/g, ' ').replace(/\s+/g, ' ').trim(); }
function round(value: number | null): string { return value == null ? '?' : value.toFixed(4); }
function validCoordinate(latitude: number | null, longitude: number | null): boolean { return latitude != null && longitude != null && Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180; }
function safeUrl(value: string | null): boolean { if (!value) return false; try { return new URL(value).protocol === 'https:'; } catch { return false; } }
