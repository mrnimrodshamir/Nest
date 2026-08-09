import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/**
 * Guards on the shipped brand artwork. These are the failures App Store Connect
 * rejects a build for, and they are invisible in code review, so they are
 * asserted straight off the PNG header.
 */
function pngHeader(relative: string) {
  const buf = readFileSync(new URL(relative, import.meta.url));
  assert.equal(buf.subarray(1, 4).toString('latin1'), 'PNG', `${relative} is not a PNG`);
  // IHDR payload begins at byte 16: width, height, bit depth, colour type.
  return {
    width: buf.readUInt32BE(16),
    height: buf.readUInt32BE(20),
    colourType: buf.readUInt8(25),
  };
}

const ALPHA_COLOUR_TYPES = new Set([4, 6]);

test('the iOS app icon is 1024x1024', () => {
  const icon = pngHeader('../../assets/icon.png');
  assert.equal(icon.width, 1024);
  assert.equal(icon.height, 1024);
});

test('the iOS app icon has NO alpha channel — App Store Connect rejects it', () => {
  const icon = pngHeader('../../assets/icon.png');
  assert.ok(!ALPHA_COLOUR_TYPES.has(icon.colourType), `colour type ${icon.colourType} carries alpha`);
});

test('the splash mark is square and full resolution', () => {
  const splash = pngHeader('../../assets/splash-icon.png');
  assert.equal(splash.width, splash.height);
  assert.ok(splash.width >= 1024);
});

test('the Android adaptive foreground keeps its transparency', () => {
  // The launcher composites this over the background colour, so alpha is
  // required here — the opposite of the iOS icon rule above.
  const fg = pngHeader('../../assets/adaptive-icon-foreground.png');
  assert.ok(ALPHA_COLOUR_TYPES.has(fg.colourType));
});

test('the in-app mark exists and is square', () => {
  const mark = pngHeader('../../assets/brand/nestup-mark.png');
  assert.equal(mark.width, mark.height);
  assert.ok(mark.width >= 512);
});

test('the launch and welcome screens render the shipped mark, not stale vector paths', () => {
  const raw = readFileSync(new URL('../components/NestUpLogo.tsx', import.meta.url), 'utf8');
  assert.match(raw, /assets\/brand\/nestup-mark\.png/);
  // Comments stripped: the file documents WHY these are banned, and that prose
  // must not trip the check it explains.
  const code = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  // The old hand-inlined SVG art must not linger alongside the real logo.
  assert.ok(!/react-native-svg/.test(code), 'the previous vector logo is still here');
  // Reanimated on the launch path caused a confirmed native SIGABRT.
  assert.ok(!/reanimated/i.test(code));
});
