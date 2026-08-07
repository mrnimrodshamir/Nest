import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildWhatsAppUrl } from '../utils/contentSharing.ts';

/** WHY THIS TEST EXISTS
 *
 *  Device testing reported WhatsApp sharing "still broken" while every
 *  sharing unit test passed. The unit tests inject a mocked `canOpenURL`
 *  that returns true, so they never exercise the real iOS gate.
 *
 *  On iOS 9+, `Linking.canOpenURL` returns FALSE for any custom scheme not
 *  declared in `LSApplicationQueriesSchemes` — even when the target app IS
 *  installed. That key was absent from app.json, so `canOpenURL('whatsapp://…')`
 *  always resolved false on device and openWhatsAppShare silently fell
 *  through to the generic share sheet every single time.
 *
 *  This asserts the CONFIG rather than the mock, which is the only layer
 *  that could have caught it. */

function infoPlist(): Record<string, unknown> {
  const app = JSON.parse(readFileSync(new URL('../../app.json', import.meta.url), 'utf8'));
  return app.expo?.ios?.infoPlist ?? {};
}

test('every custom scheme passed to canOpenURL is declared in LSApplicationQueriesSchemes', () => {
  const declared = infoPlist().LSApplicationQueriesSchemes as string[] | undefined;
  assert.ok(Array.isArray(declared), 'LSApplicationQueriesSchemes must be an array in app.json');

  // Derive the scheme from the real builder rather than hardcoding it, so a
  // change to the URL format is caught here too.
  const scheme = new URL(buildWhatsAppUrl('probe')).protocol.replace(':', '');
  assert.ok(
    declared.includes(scheme),
    `iOS canOpenURL will always return false for "${scheme}://" unless it is listed in LSApplicationQueriesSchemes. Declared: ${JSON.stringify(declared)}`,
  );
});

test('app declares the nestup scheme and retains legacy momzi for old deep links', () => {
  const app = JSON.parse(readFileSync(new URL('../../app.json', import.meta.url), 'utf8'));
  const schemes: string[] = [].concat(app.expo?.scheme ?? []);
  assert.ok(schemes.includes('nestup'), 'nestup scheme missing');
  assert.ok(schemes.includes('momzi'), 'legacy momzi scheme must remain for previously shared links');
});

test('the WhatsApp URL percent-encodes newlines, Hebrew and punctuation', () => {
  const url = buildWhatsAppUrl('שלום & hi\nline two');
  assert.ok(!url.includes('\n'), 'raw newline would truncate the message on iOS');
  assert.ok(!url.includes(' '), 'raw space must be encoded');
  assert.ok(url.includes('%0A'), 'newline should encode to %0A');
  // Hebrew must survive as UTF-8 percent-encoding, not be stripped.
  assert.ok(url.includes(encodeURIComponent('שלום')), 'Hebrew text lost in encoding');
});
