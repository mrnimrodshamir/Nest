import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyCrossCityCandidates } from './crossCityDedupe.ts';
import type { ProviderCandidate } from './types.ts';

const candidate: ProviderCandidate = { providerEventId:'1',providerTransportId:'1',sourceGroupId:null,title:'שעת סיפור לילדים',description:null,category:'story_time',sourceType:'municipal',sourceUrl:'https://example.com/1',startTime:'2026-08-24T14:00:00Z',endTime:null,locationName:'ספריית גבעתיים',formattedAddress:null,latitude:32.071,longitude:34.81,ageMinMonths:null,ageMaxMonths:null,priceNote:null,registrationRequired:null,registrationUrl:null,airConditioned:null,indoorOutdoor:null,sourcePublishedAt:null,sourceUpdatedAt:null,providerMetadata:{},occurrenceFingerprint:'x' };

test('exact syndicated cross-city listing is detected', () => { const result=classifyCrossCityCandidates([candidate],[{title:'שעת סיפור לילדים',startsAt:'2026-08-24T14:05:00Z',latitude:32.0711,longitude:34.8101,provider:'other',cityId:'ramat_gan'}]); assert.equal(result[0].classification,'EXACT'); });
test('different age session at another time remains distinct', () => { const result=classifyCrossCityCandidates([{...candidate,title:'התעמלות גילי שנתיים עד שלוש',startTime:'2026-08-24T16:00:00Z'}],[{title:'התעמלות גילי שנה עד שנתיים',startsAt:'2026-08-24T14:00:00Z',latitude:32.071,longitude:34.81,provider:'other',cityId:'ramat_gan'}]); assert.equal(result[0].classification,'DISTINCT'); });

