const BASE_URL = 'https://mbe-rg.smarticket.co.il/';
const SHOW_MARKER = '<div class="show_cube';

export interface BeitEmanuelListItem { id: string; title: string; detailUrl: string; dateText: string | null; venue: string | null }
export interface BeitEmanuelRawRecord {
  id: string; title: string; description: string | null; startsAt: string; endsAt: string | null;
  venue: string; address: string | null; registrationUrl: string; priceNote: string | null; sourceUrl: string;
}
export interface BeitEmanuelFetchResult {
  records: BeitEmanuelRawRecord[]; rawCount: number; pagesFetched: number; sourceComplete: boolean;
  incompleteReason: string | null; invalid: Array<{ id: string | null; reason: string }>;
  excluded: Array<{ id: string; reason: string }>;
}

export function parseBeitEmanuelListing(html: string): BeitEmanuelListItem[] {
  if (!html.includes(SHOW_MARKER)) return [];
  const blocks = html.split(SHOW_MARKER).slice(1);
  const seen = new Set<string>();
  return blocks.flatMap((tail) => {
    const block = SHOW_MARKER + tail.split(SHOW_MARKER)[0];
    const href = block.match(/href="([^"]*\?id=(\d+)[^"]*)"/)?.[1];
    const id = block.match(/href="[^"]*\?id=(\d+)/)?.[1];
    const title = decodeHtml(block.match(/id="show_name_\d+"[^>]*>([\s\S]*?)<\/div>/)?.[1] ?? '');
    if (!href || !id || !title || seen.has(id)) return [];
    seen.add(id);
    return [{
      id, title, detailUrl: new URL(href, BASE_URL).toString(),
      dateText: decodeHtml(block.match(/class="show_date">([\s\S]*?)<\/div>/)?.[1] ?? '') || null,
      venue: decodeHtml(block.match(/class="theater_name">([\s\S]*?)<\/div>/)?.[1] ?? '') || null,
    }];
  });
}

export function parseBeitEmanuelDetail(html: string, item: BeitEmanuelListItem): BeitEmanuelRawRecord | null {
  const scripts = [...html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)];
  for (const match of scripts) {
    try {
      const raw = JSON.parse(match[1]);
      const values = Array.isArray(raw) ? raw : [raw];
      const event = values.find((value) => value?.['@type'] === 'Event');
      if (!event) continue;
      const startsAt = normalizeJerusalemTimestamp(event.startDate);
      if (!startsAt || !event.name) return null;
      const location = event.location ?? {};
      const offer = Array.isArray(event.offers) ? event.offers[0] : event.offers;
      return {
        id: item.id,
        title: decodeHtml(String(event.name)) || item.title,
        description: decodeHtml(String(event.description ?? '')) || null,
        startsAt,
        endsAt: normalizeJerusalemTimestamp(event.endDate),
        venue: decodeHtml(String(location.name ?? item.venue ?? '')) || '',
        address: decodeHtml(String(location.streetAddress ?? '')) || null,
        registrationUrl: safeSameOriginUrl(String(offer?.url ?? item.detailUrl)) ?? item.detailUrl,
        priceNote: offer?.price === undefined || offer?.price === null ? null : `${offer.price} ${offer.priceCurrency === 'ILS' ? '₪' : String(offer.priceCurrency ?? '').trim()}`.trim(),
        sourceUrl: item.detailUrl,
      };
    } catch { continue; }
  }
  return null;
}

export async function fetchBeitEmanuelCandidates(options: { fetchImpl?: typeof fetch; now?: Date; horizonDays?: number } = {}): Promise<BeitEmanuelFetchResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const now = options.now ?? new Date();
  const horizonDays = options.horizonDays ?? 7;
  let html: string;
  try {
    const response = await fetchImpl(BASE_URL, { headers: { Accept: 'text/html', 'Accept-Language': 'he-IL,he' } });
    if (!response.ok) return incomplete(`listing HTTP ${response.status}`);
    html = await response.text();
  } catch (error) { return incomplete(`listing fetch failed: ${safeMessage(error)}`); }
  const all = parseBeitEmanuelListing(html);
  if (all.length < 10) return incomplete('listing structural drift or unexpectedly low record volume', all.length);

  const floor = startOfJerusalemDay(now).getTime();
  const ceiling = floor + horizonDays * 86_400_000;
  const start = new Date(floor).toISOString().slice(0, 10);
  const end = new Date(ceiling).toISOString().slice(0, 10);
  let calendar: any[];
  try {
    const response = await fetchImpl(`${BASE_URL}api/show_theater/get_events_calendar?start=${start}&end=${end}`, { headers: { Accept: 'application/json' } });
    if (!response.ok) return incomplete(`calendar HTTP ${response.status}`, all.length);
    const payload = await response.json();
    if (!Array.isArray(payload?.result)) return incomplete('calendar structural drift', all.length);
    calendar = payload.result;
  } catch (error) { return incomplete(`calendar fetch failed: ${safeMessage(error)}`, all.length); }
  const byId = new Map(all.map((item) => [item.id, item]));
  const invalid: Array<{ id: string | null; reason: string }> = [];
  const excluded: Array<{ id: string; reason: string }> = [];
  const targets = calendar.flatMap((row) => {
    const id = String(row?.id ?? '');
    const time = Date.parse(`${row?.start_date ?? ''}T${row?.start_time || '00:00'}:00+03:00`);
    if (!id || !Number.isFinite(time)) { invalid.push({ id: id || null, reason: 'malformed_calendar_record' }); return []; }
    if (time < floor || time >= ceiling) return [];
    const endTime = Date.parse(`${row?.end_date ?? row?.start_date ?? ''}T${row?.end_time || row?.start_time || '00:00'}:00+03:00`);
    if (!row?.start_time || (Number.isFinite(endTime) && endTime - time > 2 * 86_400_000)) {
      excluded.push({ id, reason: 'not_a_discrete_occurrence' }); return [];
    }
    const listed = byId.get(id);
    if (!listed) { invalid.push({ id, reason: 'calendar_id_missing_from_listing' }); return []; }
    return [{ ...listed, title: decodeHtml(String(row.name ?? listed.title)), dateText: `${row.start_date} ${row.start_time || '00:00'}` }];
  });
  const records: BeitEmanuelRawRecord[] = [];
  const failures: string[] = [];
  for (let offset = 0; offset < targets.length; offset += 8) {
    await Promise.all(targets.slice(offset, offset + 8).map(async (item) => {
      try {
        const response = await fetchImpl(item.detailUrl, { headers: { Accept: 'text/html', 'Accept-Language': 'he-IL,he' } });
        if (!response.ok) { failures.push(`${item.id}:HTTP_${response.status}`); return; }
        const record = parseBeitEmanuelDetail(await response.text(), item);
        if (!record) failures.push(`${item.id}:MALFORMED_DETAIL`); else records.push(record);
      } catch (error) { failures.push(`${item.id}:${safeMessage(error)}`); }
    }));
  }
  records.sort((a, b) => Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id.localeCompare(b.id));
  return {
    records, rawCount: calendar.length, pagesFetched: 2, sourceComplete: failures.length === 0 && invalid.length === 0,
    incompleteReason: failures.length ? `${failures.length} targeted detail pages failed: ${failures.slice(0, 5).join(',')}` : invalid.length ? `${invalid.length} calendar records were invalid` : null,
    invalid, excluded,
  };
}

function listingDate(text: string | null): string | null {
  const match = text?.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  return match ? `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}T00:00:00+03:00` : null;
}

function normalizeJerusalemTimestamp(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const input = value.trim();
  const withZone = /(?:Z|[+-]\d{2}:?\d{2})$/.test(input) ? input : `${input}${jerusalemOffset(input.slice(0, 10))}`;
  const parsed = new Date(withZone);
  return Number.isFinite(parsed.getTime()) ? parsed.toISOString() : null;
}

function jerusalemOffset(date: string): string {
  const midday = new Date(`${date}T12:00:00Z`);
  const localHour = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jerusalem', hour: '2-digit', hourCycle: 'h23' }).format(midday));
  return localHour >= 15 ? '+03:00' : '+02:00';
}

function startOfJerusalemDay(now: Date): Date {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(now).flatMap((p) => p.type === 'literal' ? [] : [[p.type, p.value]]));
  return new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00${jerusalemOffset(`${parts.year}-${parts.month}-${parts.day}`)}`);
}

function safeSameOriginUrl(value: string): string | null { try { const url = new URL(value, BASE_URL); return url.origin === new URL(BASE_URL).origin ? url.toString() : null; } catch { return null; } }
function decodeHtml(value: string): string { return value.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#0?39;|&apos;/gi, "'").replace(/\s+/g, ' ').trim(); }
function safeMessage(error: unknown): string { return error instanceof Error ? error.message.slice(0, 120) : 'unknown'; }
function incomplete(reason: string, rawCount = 0): BeitEmanuelFetchResult { return { records: [], rawCount, pagesFetched: 0, sourceComplete: false, incompleteReason: reason, invalid: [], excluded: [] }; }
