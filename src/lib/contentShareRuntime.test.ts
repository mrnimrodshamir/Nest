import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { openNativeShare, openWhatsAppShare, __resetShareGuard } from './contentShare.ts';

const source = readFileSync(new URL('./contentShare.ts', import.meta.url), 'utf8');
/** Comments quote the buggy pattern deliberately, so the negative assertions
 *  below must look at code only. */
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

// ===========================================================================
// THE ACTUAL DEVICE CRASH: unbound native methods
// ===========================================================================

test('ROOT CAUSE: Linking/Share methods are wrapped, never passed by reference', () => {
  // `canOpenURL: Linking.canOpenURL` detaches the method from its object. RN's
  // Linking is a class instance and Share's statics reference themselves, so
  // both throw when called with the wrong receiver. This is what crashed the
  // device build while every mocked test passed.
  assert.ok(!/canOpenURL:\s*Linking\.canOpenURL\s*[,}]/.test(code), 'canOpenURL passed unbound');
  assert.ok(!/openURL:\s*Linking\.openURL\s*[,}]/.test(code), 'openURL passed unbound');
  assert.ok(!/share:\s*Share\.share\s*[,}]/.test(code), 'Share.share passed unbound');
  assert.match(code, /canOpenURL:\s*\(url\)\s*=>\s*Linking\.canOpenURL\(url\)/);
  assert.match(code, /share:\s*\(payload\)\s*=>\s*Share\.share\(payload\)/);
});

test('REGRESSION: a receiver-sensitive dependency is actually called correctly', async () => {
  // Simulates RN's real shape: methods that need `this` to be their own object.
  const linking = {
    ok: true,
    async canOpenURL(this: { ok: boolean }) {
      if (!this || this.ok !== true) throw new TypeError("undefined is not an object (evaluating 'this.ok')");
      return true;
    },
    async openURL(this: { ok: boolean }) {
      if (!this || this.ok !== true) throw new TypeError('unbound openURL');
      return true;
    },
  };
  __resetShareGuard();
  const result = await openWhatsAppShare('Hello', {
    canOpenURL: (u) => linking.canOpenURL(u as never),
    openURL: (u) => linking.openURL(u as never),
    share: async () => undefined,
  });
  assert.equal(result, 'whatsapp');
});

// ===========================================================================
// NEVER REJECTS — callers use `void`, so a rejection is fatal in release
// ===========================================================================

test('native share resolves rather than throwing when the module blows up', async () => {
  __resetShareGuard();
  const r = await openNativeShare('hi', {
    canOpenURL: async () => true,
    openURL: async () => undefined,
    share: async () => { throw new TypeError('unbound Share.share'); },
  });
  assert.equal(r, 'failed');
});

test('WhatsApp share resolves rather than throwing when everything fails', async () => {
  __resetShareGuard();
  const boom = async () => { throw new Error('native module missing'); };
  const r = await openWhatsAppShare('hi', { canOpenURL: boom, openURL: boom, share: boom });
  assert.equal(r, 'failed');
});

test('every caller uses void, so neither function may ever reject', () => {
  for (const f of ['../screens/PlaceDetailsScreen.tsx', '../screens/EventDetailsScreen.tsx']) {
    const s = readFileSync(new URL(f, import.meta.url), 'utf8');
    assert.match(s, /void openNativeShare\(|void openWhatsAppShare\(/);
  }
  // Both functions must therefore always return, never throw.
  assert.match(source, /never rejects/i);
});

// ===========================================================================
// FALLBACK + CANCELLATION
// ===========================================================================

test('WhatsApp unavailable falls back to the native sheet', async () => {
  __resetShareGuard();
  let shared = false;
  const r = await openWhatsAppShare('hi', {
    canOpenURL: async () => false,
    openURL: async () => { throw new Error('should not be called'); },
    share: async () => { shared = true; },
  });
  assert.equal(r, 'native');
  assert.equal(shared, true);
});

test('malformed Unicode in a WhatsApp URL falls back without throwing', async () => {
  __resetShareGuard();
  let shared = false;
  const r = await openWhatsAppShare('\uD800', {
    canOpenURL: async () => true,
    openURL: async () => undefined,
    share: async () => { shared = true; },
  });
  assert.equal(r, 'native');
  assert.equal(shared, true);
});

test('user cancellation is not an error', async () => {
  __resetShareGuard();
  const r = await openNativeShare('hi', {
    canOpenURL: async () => true,
    openURL: async () => undefined,
    share: async () => { throw new Error('User dismissed'); },
  });
  assert.equal(r, 'dismissed');
});

test('native dismissedAction is recognised as cancellation', async () => {
  __resetShareGuard();
  const r = await openNativeShare('hi', {
    canOpenURL: async () => true,
    openURL: async () => undefined,
    share: async () => ({ action: 'dismissedAction' }),
    dismissedAction: 'dismissedAction',
  });
  assert.equal(r, 'dismissed');
});

// ===========================================================================
// EMPTY / MALFORMED CONTENT
// ===========================================================================

for (const bad of ['', '   ', '\n']) {
  test(`empty message (${JSON.stringify(bad)}) cannot open a share sheet`, async () => {
    __resetShareGuard();
    let called = false;
    const deps = {
      canOpenURL: async () => { called = true; return true; },
      openURL: async () => { called = true; },
      share: async () => { called = true; },
    };
    assert.equal(await openNativeShare(bad, deps), 'unavailable');
    assert.equal(await openWhatsAppShare(bad, deps), 'unavailable');
    assert.equal(called, false);
  });
}

// ===========================================================================
// DOUBLE TAP
// ===========================================================================

test('a double tap cannot open two share sheets', async () => {
  __resetShareGuard();
  let opens = 0;
  const deps = {
    canOpenURL: async () => false,
    openURL: async () => undefined,
    share: async () => {
      opens += 1;
      await new Promise((r) => setTimeout(r, 20));
    },
  };
  const [a, b] = await Promise.all([openNativeShare('hi', deps), openNativeShare('hi', deps)]);
  assert.equal(opens, 1, 'two sheets were opened');
  assert.ok([a, b].includes('opened'));
  assert.ok([a, b].includes('dismissed'));
});

test('a double tap cannot launch WhatsApp twice', async () => {
  __resetShareGuard();
  let opens = 0;
  const deps = {
    canOpenURL: async () => true,
    openURL: async () => { opens += 1; await new Promise((resolve) => setTimeout(resolve, 20)); },
    share: async () => undefined,
  };
  const [a, b] = await Promise.all([openWhatsAppShare('hello', deps), openWhatsAppShare('hello', deps)]);
  assert.equal(opens, 1);
  assert.ok([a, b].includes('whatsapp'));
  assert.ok([a, b].includes('dismissed'));
});

test('the guard clears so a later share still works', async () => {
  __resetShareGuard();
  const deps = { canOpenURL: async () => false, openURL: async () => undefined, share: async () => undefined };
  assert.equal(await openNativeShare('one', deps), 'opened');
  assert.equal(await openNativeShare('two', deps), 'opened');
});

// ===========================================================================
// HEBREW / MULTILINE / NO DIRECT CONTACT
// ===========================================================================

test('Hebrew and multiline messages share without error', async () => {
  __resetShareGuard();
  let seen = '';
  const msg = 'בוקר בים\n\nפתחו ב-NestUp:\nnestup://activity/abc';
  const r = await openWhatsAppShare(msg, {
    canOpenURL: async () => true,
    openURL: async (u) => { seen = u; },
    share: async () => undefined,
  });
  assert.equal(r, 'whatsapp');
  assert.ok(seen.startsWith('whatsapp://send?text='));
  assert.equal(decodeURIComponent(seen.replace('whatsapp://send?text=', '')), msg);
});

test('NO DIRECT CONTACT: the WhatsApp url never carries a recipient', async () => {
  __resetShareGuard();
  let seen = '';
  await openWhatsAppShare('Call 054-1234567', {
    canOpenURL: async () => true,
    openURL: async (u) => { seen = u; },
    share: async () => undefined,
  });
  assert.ok(!/phone=/i.test(seen));
  assert.ok(!/wa\.me\//i.test(seen));
});

// ===========================================================================
// ACTIVITY DETAIL USES THE SHARED HELPER
// ===========================================================================

test('Activity share goes through the guarded helper, not a raw Share call', () => {
  const s = readFileSync(new URL('../screens/ActivityDetailScreen.tsx', import.meta.url), 'utf8');
  assert.match(s, /openNativeShare\(message,/);
  assert.ok(!/await Share\.share\(/.test(s), 'ActivityDetail still calls Share.share directly');
});

test('un-awaited openURL calls are explicitly caught', () => {
  const s = readFileSync(new URL('../screens/ActivityDetailScreen.tsx', import.meta.url), 'utf8');
  assert.match(s, /Linking\.openURL\(url\)\.catch\(/);
});
