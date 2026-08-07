import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWhatsAppUrl,
  buildPlaceShareMessage,
  buildEventShareMessage,
  parseSharedContentUrl,
  contentDeepLink,
} from './contentSharing.ts';

// --- No direct venue/organizer contact -------------------------------------

test('NO DIRECT CONTACT: the WhatsApp url carries a message only, never a recipient', () => {
  const url = buildWhatsAppUrl('Hello');
  assert.ok(url.startsWith('whatsapp://send?text='));
  // A phone parameter would open a 1:1 chat with a venue or organizer.
  assert.ok(!/phone=/i.test(url), 'a recipient phone number must never be attached');
  assert.ok(!/wa\.me\//i.test(url), 'wa.me/<number> addresses a specific recipient');
});

test('NO DIRECT CONTACT: a phone number inside the message stays inert text', () => {
  const url = buildWhatsAppUrl('Call 054-123-4567');
  // Encoded into the text payload, not promoted to a routing parameter.
  assert.ok(!url.includes('phone='));
  assert.ok(url.includes(encodeURIComponent('054-123-4567')));
});

test('NO DIRECT CONTACT: share messages never embed a venue phone or email', () => {
  const message = buildPlaceShareMessage({ id: 'p1', name: 'Cafe Xoho', location: 'Tel Aviv' });
  assert.ok(!/@/.test(message), 'no email address');
  assert.ok(!/\+?\d[\d\-\s]{7,}/.test(message), 'no phone number');
});

// --- Encoding: Hebrew, multiline, and special characters -------------------

test('Hebrew share text survives encoding and round-trips exactly', () => {
  const message = 'בוקר בים\n\nפתחו ב-NestUp:\nnestup://activity/abc';
  const url = buildWhatsAppUrl(message);
  assert.equal(decodeURIComponent(url.replace('whatsapp://send?text=', '')), message);
});

test('newlines are percent-encoded rather than truncating the message', () => {
  const url = buildWhatsAppUrl('line one\nline two\n\nline four');
  assert.ok(url.includes('%0A'), 'newlines must be encoded');
  assert.ok(!url.includes('\n'), 'a raw newline would terminate the url');
});

test('characters that would break a url are encoded', () => {
  for (const raw of ['a&b', 'a?b', 'a#b', 'a=b', '100%']) {
    const url = buildWhatsAppUrl(raw);
    const payload = url.replace('whatsapp://send?text=', '');
    assert.equal(decodeURIComponent(payload), raw, raw);
  }
});

test('emoji and mixed Hebrew/English round-trip', () => {
  const message = 'Cafe Xoho תל אביב 🎉';
  const url = buildWhatsAppUrl(message);
  assert.equal(decodeURIComponent(url.replace('whatsapp://send?text=', '')), message);
});

// --- Message shape per content type ----------------------------------------

test('a place message is multiline and ends with its deep link', () => {
  const message = buildPlaceShareMessage({ id: 'p1', name: 'Cafe Xoho', location: 'Tel Aviv' });
  const lines = message.split('\n');
  assert.ok(lines.length > 1, 'must be multiline');
  assert.equal(lines[lines.length - 1], contentDeepLink('place', 'p1'));
});

test('an event message is multiline and ends with its deep link', () => {
  const message = buildEventShareMessage({
    occurrenceId: 'e1', title: 'Story time', startsAt: '2026-09-11T10:00:00Z',
    location: 'Tel Aviv', status: 'scheduled',
  });
  const lines = message.split('\n');
  assert.ok(lines.length > 1);
  assert.equal(lines[lines.length - 1], contentDeepLink('event', 'e1'));
});

test('a cancelled event says so rather than reading as a normal invite', () => {
  const message = buildEventShareMessage({
    occurrenceId: 'e1', title: 'Story time', startsAt: '2026-09-11T10:00:00Z',
    location: null, status: 'cancelled',
  });
  assert.ok(message.startsWith('Cancelled: '));
});

test('an absent location omits the line instead of leaving a blank one', () => {
  const message = buildPlaceShareMessage({ id: 'p1', name: 'Cafe Xoho', location: null });
  assert.ok(!message.includes('\n\n\n'));
});

test('an invalid start time drops the date line rather than printing "Invalid Date"', () => {
  const message = buildEventShareMessage({
    occurrenceId: 'e1', title: 'Story time', startsAt: 'not-a-date',
    location: null, status: 'scheduled',
  });
  assert.ok(!message.includes('Invalid Date'));
});

// --- Deep links round-trip through every share path ------------------------

for (const [type, id] of [['activity', 'a1'], ['place', 'p1'], ['event', 'e1']] as const) {
  test(`a shared ${type} deep link parses back to the right screen`, () => {
    const parsed = parseSharedContentUrl(contentDeepLink(type, id));
    assert.ok(parsed, `${type} link did not parse`);
    assert.ok(JSON.stringify(parsed.params).includes(id));
  });
}

test('ids needing escaping survive the share/parse round trip', () => {
  const id = 'a b/c?d#e';
  const parsed = parseSharedContentUrl(contentDeepLink('place', id));
  assert.deepEqual(parsed, { screen: 'PlaceDetails', params: { placeId: id } });
});

test('the legacy momzi:// scheme still resolves for older shared links', () => {
  assert.deepEqual(parseSharedContentUrl('momzi://activity/a1'), {
    screen: 'ActivityDetail', params: { activityId: 'a1' },
  });
});

test('arbitrary or malformed links are rejected, not routed', () => {
  for (const bad of ['nestup://settings/admin', 'https://example.com', 'nestup://activity/', 'nestup://', '']) {
    assert.equal(parseSharedContentUrl(bad), null, bad);
  }
});
