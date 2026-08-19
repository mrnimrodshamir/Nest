import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildSupportMailtoUrl, SUPPORT_EMAIL } from './supportContact.ts';

test('the support email matches the one used across the production website', () => {
  assert.equal(SUPPORT_EMAIL, 'nimrodshamir@nestup.best');
});

test('builds a mailto: link to the support address for every shipping locale', () => {
  for (const locale of ['en', 'he', 'fr', 'ru'] as const) {
    const url = buildSupportMailtoUrl(locale);
    assert.ok(url.startsWith(`mailto:${SUPPORT_EMAIL}?subject=`), `unexpected url for ${locale}: ${url}`);
  }
});

test('the subject is locale-specific, not the same English string for every language', () => {
  const subjects = (['en', 'he', 'fr', 'ru'] as const).map((locale) => buildSupportMailtoUrl(locale));
  assert.equal(new Set(subjects).size, 4);
});

test('the mailto URL contains no private user data — no name, email, child, birthdate, location, or token fields', () => {
  const url = buildSupportMailtoUrl('he');
  const forbidden = ['displayName', 'user_id', 'access_token', 'refresh_token', 'birthdate', 'latitude', 'longitude', '@gmail', '@example'];
  for (const term of forbidden) {
    assert.ok(!url.includes(term), `mailto URL unexpectedly contains "${term}": ${url}`);
  }
  // Only the fixed support address and an encoded subject — nothing else.
  const [address, query] = url.replace('mailto:', '').split('?');
  assert.equal(address, SUPPORT_EMAIL);
  assert.ok(query.startsWith('subject='));
  assert.equal(query.split('&').length, 1, 'no extra query parameters (e.g. body, cc) beyond subject');
});

test('the subject is properly URL-encoded (safe to hand directly to Linking.openURL)', () => {
  const url = buildSupportMailtoUrl('he');
  assert.doesNotMatch(url, /[\sא-ת]/, 'raw Hebrew/whitespace must be percent-encoded, not embedded literally');
});
