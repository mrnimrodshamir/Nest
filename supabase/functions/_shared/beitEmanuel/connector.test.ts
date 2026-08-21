import assert from 'node:assert/strict';
import test from 'node:test';
import { fetchBeitEmanuelCandidates, parseBeitEmanuelDetail, parseBeitEmanuelListing } from './connector.ts';
import { dedupeBeitEmanuelCandidates, mapBeitEmanuelRecord } from './mapping.ts';

const listing = `<section><div class="show_cube col"><a href="sample/?id=23863"><div id="show_name_0" class="h2">פעילות מוזיקלית לקטנטנים</div><div class="theater_name">משחקיית ר&quot;געים</div><div class="show_date">24/08/2026 16:30</div></a></div></section>`;
const detail = `<script type="application/ld+json">${JSON.stringify({ '@type':'Event', name:'פעילות מוזיקלית לקטנטנים', startDate:'2026-08-24T16:30:00', endDate:'2026-08-24T17:15:00', location:{name:'משחקיית ר"געים',streetAddress:'ביאליק 89 רמת גן'}, description:'לגילאי שנה וחצי עד שלוש', offers:{url:'https://mbe-rg.smarticket.co.il/event/23863',price:'0',priceCurrency:'ILS'} })}</script>`;

test('listing and JSON-LD normalize without provider image data', () => {
  const item = parseBeitEmanuelListing(listing)[0];
  const raw = parseBeitEmanuelDetail(detail, item)!;
  assert.equal(raw.id, '23863');
  assert.equal(raw.startsAt, '2026-08-24T13:30:00.000Z');
  const mapped = mapBeitEmanuelRecord(raw);
  assert.equal(mapped.candidate?.providerEventId, '23863');
  assert.equal(mapped.candidate?.providerMetadata.cityId, 'ramat_gan');
  assert.equal(mapped.candidate?.ageMinMonths, 18);
  assert.equal(mapped.candidate?.ageMaxMonths, 36);
  assert.equal(JSON.stringify(mapped), JSON.stringify(mapped).replace(/imageUrl|image_url/g, 'imageUrl'));
});

test('exact duplicate sale records collapse but age-group titles remain separate', () => {
  const item = parseBeitEmanuelListing(listing)[0];
  const raw = parseBeitEmanuelDetail(detail, item)!;
  const first = mapBeitEmanuelRecord(raw).candidate!;
  const duplicate = mapBeitEmanuelRecord({ ...raw, id: '99999' }).candidate!;
  const ageVariant = mapBeitEmanuelRecord({ ...raw, id: '99998', title: 'פעילות מוזיקלית לגילאי שנתיים וחצי עד שלוש וחצי' }).candidate!;
  const result = dedupeBeitEmanuelCandidates([first, duplicate, ageVariant]);
  assert.equal(result.duplicateCount, 1);
  assert.equal(result.candidates.length, 2);
});

test('similar age-group sessions retain separate provider identities', () => {
  const item = parseBeitEmanuelListing(listing)[0];
  const raw = parseBeitEmanuelDetail(detail, item)!;
  const first = mapBeitEmanuelRecord(raw).candidate!;
  const second = mapBeitEmanuelRecord({ ...raw, id: '23864', title: 'פעילות מוזיקלית לגילאי שנתיים וחצי עד שלוש וחצי' }).candidate!;
  assert.notEqual(first.providerEventId, second.providerEventId);
  assert.notEqual(first.occurrenceFingerprint, second.occurrenceFingerprint);
});

test('partial detail fetch fails closed', async () => {
  const many = Array.from({ length: 12 }, (_, index) => listing.replaceAll('23863', String(23863 + index))).join('');
  const calendar = { result: Array.from({ length: 12 }, (_, index) => ({ id: 23863 + index, name: 'פעילות משפחתית', start_date: '2026-08-24', start_time: '16:30' })) };
  const fetchImpl = async (url: string | URL | Request) => new Response(String(url).includes('get_events_calendar') ? JSON.stringify(calendar) : String(url).includes('?id=') ? 'broken' : many, { status: 200 });
  const result = await fetchBeitEmanuelCandidates({ fetchImpl: fetchImpl as typeof fetch, now: new Date('2026-08-24T08:00:00Z') });
  assert.equal(result.sourceComplete, false);
  assert.match(result.incompleteReason ?? '', /targeted detail pages failed/);
});
