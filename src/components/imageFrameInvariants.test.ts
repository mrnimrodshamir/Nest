import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

/** THE OVERSIZED-CARD REGRESSION GUARD
 *
 *  Device testing showed Place cards (MUZA / Eretz Israel Museum) growing to
 *  ~900pt tall with the body squeezed into a narrow column.
 *
 *  Mechanism: a container sized only by `minHeight` has an INDEFINITE height.
 *  A child asking for `height: '100%'` cannot resolve against an indefinite
 *  parent, so Yoga discards it and lays the child out at its INTRINSIC size.
 *  CategoryArtwork's fallback is a bundled require()d asset of ~1200x900
 *  POINTS, so the container grew to fit it.
 *
 *  These are source-level assertions rather than render tests because the
 *  failure is a *style declaration* property. A render test would need a full
 *  Yoga layout pass with real intrinsic image sizes, which the node test
 *  runner cannot provide — and mocked render tests are exactly what missed
 *  this the first time. */

function read(file: string): string {
  return readFileSync(new URL(file, import.meta.url), 'utf8');
}

/** Extract `name: { ... }` style blocks from a StyleSheet.create literal. */
function styleBlocks(source: string): Map<string, string> {
  const blocks = new Map<string, string>();
  const re = /(\w+):\s*\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(source))) blocks.set(m[1], m[2]);
  return blocks;
}

const IMAGE_FRAMES: Array<{ file: string; block: string }> = [
  { file: './PlaceImage.tsx', block: 'card' },
  { file: './PlaceImage.tsx', block: 'cover' },
];

for (const { file, block } of IMAGE_FRAMES) {
  test(`${file} → ${block}: has a DEFINITE height (height or aspectRatio), never minHeight alone`, () => {
    const decl = styleBlocks(read(file)).get(block);
    assert.ok(decl, `style block "${block}" not found in ${file}`);

    const hasDefinite = /(^|[^n])\bheight:/.test(decl) || /\baspectRatio:/.test(decl);
    const hasMinHeightOnly = /\bminHeight:/.test(decl) && !hasDefinite;

    assert.ok(
      !hasMinHeightOnly,
      `${file} → ${block} is sized by minHeight with no height/aspectRatio. ` +
        `That leaves the height indefinite, so a child's height:'100%' is discarded ` +
        `and a bundled asset lays out at ~900pt intrinsic size. Declared: {${decl.trim()}}`,
    );
    assert.ok(hasDefinite, `${file} → ${block} must declare height or aspectRatio`);
  });
}

test('PlaceCard row bounds its height so one card cannot dominate the feed', () => {
  const decl = styleBlocks(read('./PlaceCard.tsx')).get('card');
  assert.ok(decl, 'PlaceCard card style not found');
  assert.ok(/\bmaxHeight:/.test(decl), 'PlaceCard.card must declare maxHeight');
});

test('the image frame does not stretch to the row height', () => {
  const decl = styleBlocks(read('./PlaceImage.tsx')).get('card');
  assert.ok(
    /alignSelf:\s*'flex-start'/.test(decl ?? ''),
    "PlaceImage.card must set alignSelf:'flex-start'; a row's default align-stretch " +
      'would otherwise let the row height flow back into the image box',
  );
});

test('ContentImage renders its FALLBACK absolutely filled, like the remote image', () => {
  const source = read('./ContentImage.tsx');
  // Both branches must be absolutely positioned; otherwise the fallback is a
  // normal flow child and can contribute intrinsic height.
  const absoluteFillCount = (source.match(/StyleSheet\.absoluteFill/g) ?? []).length;
  assert.ok(
    absoluteFillCount >= 2,
    `expected both the <Image> and the fallback to use StyleSheet.absoluteFill, found ${absoluteFillCount} use(s). ` +
      'A flow-positioned fallback is what allowed a 1200x900pt bundled asset to size the card.',
  );
});

test('ContentImage clips its content', () => {
  assert.ok(/overflow:\s*'hidden'/.test(read('./ContentImage.tsx')), 'container must clip');
});
