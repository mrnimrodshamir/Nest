const BASE_URL = 'https://www.givatayim.muni.il/';
const EVENTS_URL = `${BASE_URL}events/`;
const IPLAN_BOUNDARY_URL = 'https://ags.iplan.gov.il/arcgisiplan/rest/services/PlanningPublic/gvulot_retzef/MapServer/1/query';

export interface GivatayimListItem {
  id: string; title: string; detailUrl: string; dateText: string; timeText: string;
  venue: string; priceNote: string | null; tags: string[];
}
export interface GivatayimRawRecord extends GivatayimListItem {
  description: string | null; startsAt: string; endsAt: string | null;
  latitude: number; longitude: number; registrationUrl: string | null;
}
export interface GivatayimFetchResult {
  records: GivatayimRawRecord[]; rawCount: number; pagesFetched: number;
  sourceComplete: boolean; incompleteReason: string | null;
  invalid: Array<{ id: string | null; reason: string }>;
  excluded: Array<{ id: string; reason: string }>;
}

export function parseGivatayimListing(html: string): GivatayimListItem[] {
  const blocks = html.split(/<a\s+href="\.\/events\/(\d+)\/"[^>]*class="event-promo"[^>]*>/i);
  const rows: GivatayimListItem[] = [];
  for (let index = 1; index < blocks.length; index += 2) {
    const id = blocks[index];
    const block = blocks[index + 1]?.split('</a>')[0] ?? '';
    const title = text(block.match(/<h2[^>]*class="name[^>]*>([\s\S]*?)<\/h2>/i)?.[1] ?? '');
    const dateText = text(block.match(/<div[^>]*class="date[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '');
    const timeText = text(block.match(/<div[^>]*class="time[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '');
    const venue = text(block.match(/<div[^>]*class="place[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '');
    const priceNote = text(block.match(/<div[^>]*class="price[^>]*>([\s\S]*?)<\/div>/i)?.[1] ?? '') || null;
    const tags = [...block.matchAll(/class="badge[^>]*>\s*#?([\s\S]*?)<\/span>/gi)].map((match) => text(match[1])).filter(Boolean);
    if (id && title && dateText && timeText && venue) rows.push({ id, title, detailUrl: `${EVENTS_URL}${id}/`, dateText, timeText, venue, priceNote, tags });
  }
  return [...new Map(rows.map((row) => [row.id, row])).values()];
}

export function parseGivatayimDetail(html: string, item: GivatayimListItem): GivatayimRawRecord | null {
  const dateTime = parseDateTime(item.dateText, item.timeText);
  const coordinates = parseWazeCoordinates(html);
  if (!dateTime || !coordinates) return null;
  const content = html.match(/id="event-page-content"[^>]*>[\s\S]*?<div[^>]*class="rich-content"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i)?.[1] ?? '';
  const registration = [...html.matchAll(/<a\s+href="([^"]+)"[^>]*>(?:[^<]*)(?:הזמנת כרטיסים|הרשמה)(?:[^<]*)<\/a>/gi)]
    .map((match) => safeHttpUrl(match[1])).find(Boolean) ?? null;
  return {
    ...item, description: text(content) || null, startsAt: dateTime.startsAt,
    endsAt: dateTime.endsAt, latitude: coordinates.latitude, longitude: coordinates.longitude,
    registrationUrl: registration,
  };
}

export async function fetchGivatayimCandidates(options: { fetchImpl?: typeof fetch; now?: Date; horizonDays?: number } = {}): Promise<GivatayimFetchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? new Date();
  const horizonDays = options.horizonDays ?? 7;
  const invalid: GivatayimFetchResult['invalid'] = [];
  const excluded: GivatayimFetchResult['excluded'] = [];
  let listing = '';
  try {
    const response = await fetchImpl(EVENTS_URL, { headers: { Accept: 'text/html', 'Accept-Language': 'he-IL,he' } });
    if (!response.ok) return incomplete(`listing HTTP ${response.status}`);
    listing = await response.text();
  } catch (error) { return incomplete(`listing fetch failed: ${safeMessage(error)}`); }
  const all = parseGivatayimListing(listing);
  const advertisedIds = new Set([...listing.matchAll(/href="\.\/events\/(\d+)\//gi)].map((match) => match[1]));
  if (all.length < 10 || all.length !== advertisedIds.size) return incomplete('listing structural drift or unexpectedly low record volume', all.length);
  const floor = now.getTime();
  const ceiling = floor + horizonDays * 86_400_000;
  const targets = all.filter((item) => {
    const parsed = parseDateTime(item.dateText, item.timeText);
    if (!parsed) { invalid.push({ id: item.id, reason: 'malformed_listing_datetime' }); return false; }
    const time = Date.parse(parsed.startsAt);
    if (time < floor || time >= ceiling) { excluded.push({ id: item.id, reason: 'outside_7_day_window' }); return false; }
    return true;
  });
  let polygon: readonly (readonly [number, number])[];
  try { polygon = await fetchOfficialBoundary(fetchImpl); }
  catch (error) { return incomplete(`authoritative boundary fetch failed: ${safeMessage(error)}`, all.length); }
  const records: GivatayimRawRecord[] = [];
  const failures: string[] = [];
  for (let offset = 0; offset < targets.length; offset += 8) {
    await Promise.all(targets.slice(offset, offset + 8).map(async (item) => {
      try {
        const response = await fetchImpl(item.detailUrl, { headers: { Accept: 'text/html', 'Accept-Language': 'he-IL,he' } });
        if (!response.ok) { failures.push(`${item.id}:HTTP_${response.status}`); return; }
        const record = parseGivatayimDetail(await response.text(), item);
        if (!record) { failures.push(`${item.id}:MALFORMED_DETAIL`); return; }
        if (!pointInPolygon(record.longitude, record.latitude, polygon)) { excluded.push({ id: item.id, reason: 'outside_official_givatayim_boundary' }); return; }
        records.push(record);
      } catch (error) { failures.push(`${item.id}:${safeMessage(error)}`); }
    }));
  }
  records.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id.localeCompare(b.id));
  return {
    records, rawCount: all.length, pagesFetched: 2 + targets.length,
    sourceComplete: failures.length === 0 && invalid.length === 0,
    incompleteReason: failures.length ? `${failures.length} detail pages failed: ${failures.slice(0, 5).join(',')}` : invalid.length ? `${invalid.length} listing records invalid` : null,
    invalid, excluded,
  };
}

async function fetchOfficialBoundary(fetchImpl: typeof fetch): Promise<readonly (readonly [number, number])[]> {
  const params = new URLSearchParams({ where: "CR_LAMAS='6300'", outFields: 'CR_LAMAS,Muni_Heb', returnGeometry: 'true', outSR: '4326', f: 'geojson' });
  const response = await fetchImpl(`${IPLAN_BOUNDARY_URL}?${params}`, { headers: { Accept: 'application/geo+json,application/json' } });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const payload = await response.json() as any;
  const feature = payload?.features?.[0];
  if (feature?.properties?.CR_LAMAS !== '6300' || feature?.geometry?.type !== 'Polygon' || !Array.isArray(feature.geometry.coordinates?.[0])) throw new Error('malformed boundary');
  return feature.geometry.coordinates[0];
}

function parseDateTime(dateText: string, timeText: string): { startsAt: string; endsAt: string | null } | null {
  const date = dateText.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  const times = [...timeText.matchAll(/(\d{1,2}):(\d{2})/g)];
  if (!date || !times[0]) return null;
  const day = date[1].padStart(2, '0'); const month = date[2].padStart(2, '0'); const year = date[3];
  const startLocal = `${year}-${month}-${day}T${times[0][1].padStart(2, '0')}:${times[0][2]}:00`;
  const startsAt = zonedIso(startLocal);
  const endsAt = times[1] ? zonedIso(`${year}-${month}-${day}T${times[1][1].padStart(2, '0')}:${times[1][2]}:00`) : null;
  return startsAt ? { startsAt, endsAt } : null;
}
function zonedIso(local: string): string | null { const date = local.slice(0, 10); const parsed = new Date(`${local}${jerusalemOffset(date)}`); return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null; }
function jerusalemOffset(date: string): string { const hour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', hour: '2-digit', hourCycle: 'h23' }).format(new Date(`${date}T12:00:00Z`))); return hour >= 15 ? '+03:00' : '+02:00'; }
function parseWazeCoordinates(html: string): { latitude: number; longitude: number } | null { const match = html.match(/waze\.com\/ul\?ll=(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/i); const latitude = Number(match?.[1]); const longitude = Number(match?.[2]); return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? { latitude, longitude } : null; }
function pointInPolygon(x: number, y: number, polygon: readonly (readonly [number, number])[]): boolean { let inside = false; for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) { const [xi, yi] = polygon[i]; const [xj, yj] = polygon[j]; if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside; } return inside; }
function safeHttpUrl(value: string): string | null { try { const url = new URL(value, BASE_URL); return url.protocol === 'https:' ? url.toString() : null; } catch { return null; } }
function text(value: string): string { return value.replace(/<br\s*\/?\s*>/gi, ' ').replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#0?39;|&apos;/gi, "'").replace(/\s+/g, ' ').trim(); }
function safeMessage(error: unknown): string { return error instanceof Error ? error.message.slice(0, 120) : 'unknown'; }
function incomplete(reason: string, rawCount = 0): GivatayimFetchResult { return { records: [], rawCount, pagesFetched: 0, sourceComplete: false, incompleteReason: reason, invalid: [], excluded: [] }; }
