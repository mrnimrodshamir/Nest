import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveActivityArt } from './resolveActivityArt.ts';

test('resolveActivityArt: a known category with the requested variant installed resolves directly, no warning', () => {
  const assets = { stroller_walk: { thumb: 'stroller_walk_thumb.jpg' } };
  const result = resolveActivityArt('stroller_walk', 'thumb', assets);
  assert.equal(result.kind, 'photo');
  assert.equal(result.resolvedCategory, 'stroller_walk');
  assert.equal(result.warning, null);
});

test('resolveActivityArt: an unknown category falls back to "other", same variant, with a warning', () => {
  const assets = { other: { card: 'other_card.jpg' } };
  const result = resolveActivityArt('some_future_category', 'card', assets);
  assert.equal(result.kind, 'photo');
  assert.equal(result.resolvedCategory, 'other');
  assert.match(result.warning, /unknown activity category/i);
});

test('resolveActivityArt: a known category missing just one variant falls back to "other" for that variant only, with a warning', () => {
  const assets = {
    stroller_walk: { thumb: 'stroller_walk_thumb.jpg' }, // no hero yet
    other: { hero: 'other_hero.jpg' },
  };
  const result = resolveActivityArt('stroller_walk', 'hero', assets);
  assert.equal(result.kind, 'photo');
  assert.equal(result.resolvedCategory, 'other');
  assert.match(result.warning, /missing "hero" artwork for category "stroller_walk"/i);
});

test('resolveActivityArt: never substitutes a different variant for the one requested', () => {
  // stroller_walk has a hero and a card, but no thumb -- resolving "thumb"
  // must never return the hero or card asset, only fall through to
  // other's thumb (or the placeholder if that's missing too).
  const assets = {
    stroller_walk: { hero: 'stroller_walk_hero.jpg', card: 'stroller_walk_card.jpg' },
    other: { thumb: 'other_thumb.jpg' },
  };
  const result = resolveActivityArt('stroller_walk', 'thumb', assets);
  assert.equal(result.kind, 'photo');
  assert.equal(result.resolvedCategory, 'other');
});

test('resolveActivityArt: nothing installed anywhere for this variant returns a placeholder, not a crash', () => {
  const result = resolveActivityArt('stroller_walk', 'card', {});
  assert.equal(result.kind, 'placeholder');
  assert.match(result.warning, /no "card" artwork installed/i);
});

test('resolveActivityArt: "other" itself missing the variant also falls through to placeholder', () => {
  const assets = { other: { hero: 'other_hero.jpg' } }; // no thumb
  const result = resolveActivityArt('other', 'thumb', assets);
  assert.equal(result.kind, 'placeholder');
});

test('resolveActivityArt: an unknown category with nothing installed for "other" either still returns a placeholder, not a crash', () => {
  const result = resolveActivityArt('some_future_category', 'hero', {});
  assert.equal(result.kind, 'placeholder');
  assert.match(result.warning, /no "hero" artwork installed/i);
});
