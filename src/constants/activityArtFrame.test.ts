import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVITY_ART_ASPECT,
  HERO_MAX_HEIGHT_RATIO,
  resolveFrameHeight,
  resolveHeroMaxHeight,
  resolveHeroRenderedHeight,
} from './activityArtFrame.ts';
import { ACTIVITY_ART_VARIANT_SPEC } from './activityArtManifest.ts';

test('every frame aspect ratio matches its source artwork ratio, so cover never crops or stretches', () => {
  for (const [variant, spec] of Object.entries(ACTIVITY_ART_VARIANT_SPEC)) {
    const sourceAspect = spec.width / spec.height;
    const frameAspect = ACTIVITY_ART_ASPECT[variant as keyof typeof ACTIVITY_ART_ASPECT];
    assert.ok(
      Math.abs(sourceAspect - frameAspect) < 0.0001,
      `${variant}: frame ${frameAspect} != source ${sourceAspect}`,
    );
  }
});

test('card is 16:9 and thumb/hero are 4:3 — a card can never be given hero proportions', () => {
  assert.equal(ACTIVITY_ART_ASPECT.card, 16 / 9);
  assert.equal(ACTIVITY_ART_ASPECT.thumb, 4 / 3);
  assert.equal(ACTIVITY_ART_ASPECT.hero, 4 / 3);
  assert.notEqual(ACTIVITY_ART_ASPECT.card, ACTIVITY_ART_ASPECT.hero);
});

test('resolveFrameHeight: a full-width card on a 375pt screen is a compact banner, not a block', () => {
  // iPhone SE content width after 2x16pt gutters.
  const height = resolveFrameHeight('card', 343);
  assert.ok(height > 190 && height < 195, `expected ~193, got ${height}`);
});

test('resolveFrameHeight: a 64pt chat thumb stays a small row-sized tile', () => {
  assert.equal(resolveFrameHeight('thumb', 64), 48);
});

test('resolveHeroMaxHeight: hero is capped to a third of the viewport', () => {
  assert.equal(HERO_MAX_HEIGHT_RATIO, 0.32);
  assert.equal(resolveHeroMaxHeight(667), 213); // iPhone SE
  assert.equal(resolveHeroMaxHeight(852), 273); // iPhone 15
});

test('resolveHeroRenderedHeight: the cap actually binds on a small screen', () => {
  // iPhone SE: 4:3 at 327pt wide would be 245pt — taller than the 213pt cap,
  // which is precisely the "hero dominates the viewport" regression.
  const natural = resolveFrameHeight('hero', 327);
  const rendered = resolveHeroRenderedHeight(327, 667);
  assert.ok(natural > rendered, 'cap should reduce the natural height on iPhone SE');
  assert.equal(rendered, 213);
});

test('resolveHeroRenderedHeight: hero never exceeds a third of the screen on any common device', () => {
  const devices: Array<[number, number]> = [
    [327, 667], // iPhone SE
    [361, 780], // iPhone 13 mini
    [361, 852], // iPhone 15
    [398, 932], // iPhone 15 Pro Max
  ];
  for (const [width, screenHeight] of devices) {
    const rendered = resolveHeroRenderedHeight(width, screenHeight);
    assert.ok(
      rendered <= screenHeight * HERO_MAX_HEIGHT_RATIO + 1,
      `hero ${rendered}pt exceeds cap on ${width}x${screenHeight}`,
    );
  }
});

test('resolveFrameHeight scales linearly with width — no fixed oversized height anywhere', () => {
  assert.equal(resolveFrameHeight('card', 300) * 2, resolveFrameHeight('card', 600));
});
