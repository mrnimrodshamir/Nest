import assert from 'node:assert/strict';
import test from 'node:test';
import { openNativeShare, openWhatsAppShare, type ShareDependencies } from '@/lib/contentShare';
import {
  buildEventShareMessage,
  buildPlaceShareMessage,
  buildWhatsAppUrl,
  contentDeepLink,
  parseSharedContentUrl,
} from '@/utils/contentSharing';

test('Place share copy is concise, branded, and has one stable deep link', () => {
  const message = buildPlaceShareMessage({ id: 'place-1', name: 'Beit Ariela Library', location: 'Tel Aviv' });
  assert.equal(message, 'Discover Beit Ariela Library\nTel Aviv\n\nOpen in NestUp:\nnestup://place/place-1');
  assert.equal(message.match(/Beit Ariela Library/g)?.length, 1);
});

test('Event share preserves Hebrew and special characters through WhatsApp encoding', () => {
  const message = buildEventShareMessage({ occurrenceId: 'אירוע/1', title: 'שעת סיפור & יצירה', startsAt: '2026-08-06T14:00:00.000Z', location: 'בית אריאלה', status: 'scheduled' });
  const url = buildWhatsAppUrl(message);
  assert.ok(url.startsWith('whatsapp://send?text='));
  assert.equal(decodeURIComponent(url.split('text=')[1]), message);
  assert.match(message, /NestUp/);
});

test('cancelled and postponed events are never shared as normal live invitations', () => {
  assert.match(buildEventShareMessage({ occurrenceId: '1', title: 'Story time', startsAt: '2026-08-06T14:00:00Z', location: null, status: 'cancelled' }), /^Cancelled:/);
  assert.match(buildEventShareMessage({ occurrenceId: '1', title: 'Story time', startsAt: '2026-08-06T14:00:00Z', location: null, status: 'postponed' }), /^Postponed:/);
});

test('WhatsApp falls back to native sharing and dismissal is safe', async () => {
  const calls: string[] = [];
  const dependencies: ShareDependencies = {
    canOpenURL: async () => false,
    openURL: async () => { calls.push('whatsapp'); },
    share: async ({ message }) => { calls.push(message); },
  };
  assert.equal(await openWhatsAppShare('hello', dependencies), 'native');
  assert.deepEqual(calls, ['hello']);
  assert.equal(await openNativeShare('hello', { ...dependencies, share: async () => { throw new Error('dismissed'); } }), 'dismissed');
});

test('canonical and legacy links route Activity, Place, and Event safely', () => {
  assert.deepEqual(parseSharedContentUrl('nestup://activity/a1'), { screen: 'ActivityDetail', params: { activityId: 'a1' } });
  assert.deepEqual(parseSharedContentUrl('nestup://place/p1'), { screen: 'PlaceDetails', params: { placeId: 'p1' } });
  assert.deepEqual(parseSharedContentUrl('nestup://event/e1'), { screen: 'EventDetails', params: { occurrenceId: 'e1' } });
  assert.deepEqual(parseSharedContentUrl('momzi://activity/legacy'), { screen: 'ActivityDetail', params: { activityId: 'legacy' } });
  assert.equal(parseSharedContentUrl('https://attacker.example/activity/a1'), null);
  assert.equal(contentDeepLink('event', 'event with spaces'), 'nestup://event/event%20with%20spaces');
});

test('malformed identifiers are omitted instead of crashing or creating broken links', () => {
  assert.equal(contentDeepLink('event', '\uD800'), '');
  assert.doesNotThrow(() => buildEventShareMessage({ occurrenceId: '\uD800', title: 'Family day', startsAt: '2026-08-06T14:00:00Z', location: null, status: 'scheduled' }));
  assert.doesNotMatch(buildPlaceShareMessage({ id: '', name: 'Park', location: null }), /nestup:\/\//);
});
