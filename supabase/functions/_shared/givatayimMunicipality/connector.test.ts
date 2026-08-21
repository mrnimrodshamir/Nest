import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGivatayimDetail, parseGivatayimListing, fetchGivatayimCandidates } from './connector.ts';
import { dedupeGivatayimCandidates, mapGivatayimRecord } from './mapping.ts';

const listing = `<a href="./events/10053/" class="event-promo"><div class="details"><h2 class="name mb-2"> אריה לבנת </h2><div class="date mb-2"><span>icon</span>יום ראשון, 23.08.2026</div><div class="time mb-2">17:00 - 17:45</div><div class="place mb-2">מרכז קהילתי שז&quot;ר, יבניאלי 30 גבעתיים<br></div><div class="price mb-2">25 ₪</div><div class="tags"><span class="badge">#שלוש עד ארבע</span><span class="badge">#ילדים</span></div></div></a>`;
const detail = `<div class="event-item-value">יום ראשון, 23/08/2026 <br>17:00 - 17:45</div><a href="https://waze.com/ul?ll=32.0622,34.817&navigate=yes">Waze</a><a href="https://www.coing.co/test/1">הזמנת כרטיסים</a><div id="event-page-content"><div class="rich-content"><p>מפגש מוסיקלי לילדים</p></div></div>`;

test('parses stable municipal listing and detail fields', () => {
  const item = parseGivatayimListing(listing)[0];
  assert.deepEqual({ id: item.id, title: item.title, venue: item.venue, tags: item.tags }, { id: '10053', title: 'אריה לבנת', venue: 'מרכז קהילתי שז"ר, יבניאלי 30 גבעתיים', tags: ['שלוש עד ארבע', 'ילדים'] });
  const record = parseGivatayimDetail(detail, item)!;
  assert.equal(record.startsAt, '2026-08-23T14:00:00.000Z');
  assert.equal(record.endsAt, '2026-08-23T14:45:00.000Z');
  assert.deepEqual([record.latitude, record.longitude], [32.0622, 34.817]);
  assert.equal(record.registrationUrl, 'https://www.coing.co/test/1');
});

test('maps only family rows and keeps municipal images out of app-facing fields', () => {
  const record = parseGivatayimDetail(detail, parseGivatayimListing(listing)[0])!;
  const candidate = mapGivatayimRecord(record)!;
  assert.equal(candidate.providerEventId, '10053');
  assert.equal(candidate.providerMetadata.cityId, 'givatayim');
  assert.equal(candidate.providerMetadata.imageRightsCleared, false);
  assert.equal(candidate.ageMinMonths, 36);
  assert.equal(candidate.ageMaxMonths, 48);
});

test('exact content duplicates collapse while different sessions remain distinct', () => {
  const record = parseGivatayimDetail(detail, parseGivatayimListing(listing)[0])!;
  const first = mapGivatayimRecord(record)!;
  const duplicate = { ...first, providerEventId: '20000', providerTransportId: '20000' };
  const later = { ...first, providerEventId: '20001', providerTransportId: '20001', startTime: '2026-08-23T15:00:00.000Z' };
  const result = dedupeGivatayimCandidates([first, duplicate, later]);
  assert.equal(result.duplicateCount, 1);
  assert.equal(result.candidates.length, 2);
});

test('fetch fails closed when the authoritative boundary cannot be verified', async () => {
  const fetchImpl = async (input: string | URL | Request) => {
    const url = String(input);
    if (url.includes('givatayim.muni.il/events/')) return new Response(Array.from({ length: 12 }, (_, index) => listing.replaceAll('10053', String(10053 + index))).join(''), { status: 200 });
    return new Response('{}', { status: 500 });
  };
  const result = await fetchGivatayimCandidates({ fetchImpl: fetchImpl as typeof fetch, now: new Date('2026-08-21T12:00:00Z') });
  assert.equal(result.sourceComplete, false);
  assert.match(result.incompleteReason ?? '', /boundary/);
  assert.equal(result.records.length, 0);
});
