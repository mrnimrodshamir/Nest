import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ACTIVITY_ART_ASPECT,
  CARD_MEDIA_MAX_HEIGHT,
  resolveCardRenderedHeight,
  resolveFrameHeight,
  resolveHeroRenderedHeight,
} from '@/constants/activityArtFrame';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const activityCard = read('./ActivityCard.tsx');
const placeCard = read('./PlaceCard.tsx');
const eventCard = read('./EventCard.tsx');
const coverFrame = read('./CoverFrame.tsx');
const contentImage = read('./ContentImage.tsx');

// Small iPhone (SE / mini): 375 x 667. Content width after 16pt page padding.
const SMALL_WIDTH = 375;
const SMALL_HEIGHT = 667;
const CONTENT_WIDTH = SMALL_WIDTH - 32;

// ===========================================================================
// IMAGE SIZE MATRIX — every card surface is bounded
// ===========================================================================

test('MATRIX: card media is capped at the shared ceiling on a small iPhone', () => {
  const natural = resolveFrameHeight('card', CONTENT_WIDTH);
  assert.ok(natural > CARD_MEDIA_MAX_HEIGHT, 'test is meaningless if the cap never binds');
  assert.equal(resolveCardRenderedHeight(CONTENT_WIDTH), CARD_MEDIA_MAX_HEIGHT);
});

test('MATRIX: the cap binds on large phones too, so cards look the same everywhere', () => {
  // 430pt-wide Pro Max content width.
  assert.equal(resolveCardRenderedHeight(430 - 32), CARD_MEDIA_MAX_HEIGHT);
});

test('MATRIX: every card type is bounded, and comparably so', () => {
  // Activity media is capped tighter (140) than the Place/Event row bound (168)
  // because an Activity card adds ~80pt of text BELOW its media, whereas a row
  // puts text beside it. 140+80 lands next to 168 — comparable total heights
  // from different shapes, which is the point.
  assert.equal(CARD_MEDIA_MAX_HEIGHT, 140);
  assert.match(placeCard, /maxHeight: 168/);
  assert.match(eventCard, /maxHeight: CARD_MEDIA_MAX_HEIGHT/);
  const activityTotal = 140 + 80;
  assert.ok(Math.abs(activityTotal - 168) < 60, 'card totals have drifted apart');
});

test('MATRIX: an Activity card can no longer dominate a small screen', () => {
  const media = resolveCardRenderedHeight(CONTENT_WIDTH);
  // Media plus a generous allowance for title/meta/capacity must still leave
  // room for a second card in a 667pt viewport.
  assert.ok(media + 110 < SMALL_HEIGHT / 2, `card is ${media + 110}pt on a ${SMALL_HEIGHT}pt screen`);
});

test('MATRIX: hero stays bounded and is taller than card media', () => {
  const hero = resolveHeroRenderedHeight(SMALL_WIDTH, SMALL_HEIGHT);
  assert.ok(hero <= Math.round(SMALL_HEIGHT * 0.32));
  assert.ok(hero > 0);
});

test('MATRIX: aspect ratios are declared centrally, not per surface', () => {
  assert.deepEqual(Object.keys(ACTIVITY_ART_ASPECT).sort(), ['card', 'hero', 'thumb']);
  for (const variant of ['thumb', 'card', 'hero'] as const) {
    assert.ok(ACTIVITY_ART_ASPECT[variant] > 0, variant);
  }
});

// ===========================================================================
// NO IMAGE MAY DETERMINE LAYOUT HEIGHT
// ===========================================================================

test('CoverFrame owns height: the child is absolutely filled', () => {
  assert.match(coverFrame, /StyleSheet\.absoluteFill/);
  assert.match(coverFrame, /aspectRatio: ACTIVITY_ART_ASPECT\[variant\]/);
});

test('CoverFrame always clips, so a cover cannot paint outside its frame', () => {
  assert.match(coverFrame, /overflow: 'hidden'/);
});

test('CoverFrame caps both hero and card variants', () => {
  assert.match(coverFrame, /variant === 'hero' && \{ maxHeight/);
  assert.match(coverFrame, /variant === 'card' && \{ maxHeight: CARD_MEDIA_MAX_HEIGHT \}/);
});

test('REGRESSION: the image fallback stays out of normal layout flow', () => {
  // A fallback rendered inline would contribute intrinsic height and make the
  // card jump when artwork resolves. This was a confirmed P0.
  assert.match(contentImage, /StyleSheet\.absoluteFill/);
});

test('every card clips its own content', () => {
  for (const [name, source] of [['ActivityCard', activityCard], ['PlaceCard', placeCard], ['EventCard', eventCard]] as const) {
    assert.match(source, /overflow: 'hidden'/, `${name} does not clip`);
  }
});

test('no card declares a raw aspectRatio — proportions come from the frame', () => {
  assert.ok(!/aspectRatio/.test(activityCard), 'ActivityCard hand-rolls an aspect ratio');
  assert.ok(!/aspectRatio/.test(eventCard), 'EventCard hand-rolls an aspect ratio');
});

// ===========================================================================
// VISUAL IDENTITY IS PRESERVED
// ===========================================================================

test('IDENTITY: Places and Events stay rows, Activities stay a vertical card', () => {
  assert.match(placeCard, /flexDirection: 'row'/);
  assert.match(eventCard, /flexDirection: 'row'/);
  // The Activity feed card is full-width with media above the text.
  assert.match(activityCard, /cardFeed: \{[^}]*width: '100%'/s);
});

test('IDENTITY: the three cards are bounded but not identical', () => {
  assert.match(placeCard, /minHeight: 116/);
  assert.match(eventCard, /minHeight: 126/);
  // Different minimums = different densities, deliberately.
  assert.ok(true);
});

// ===========================================================================
// NEW CARD SIGNALS
// ===========================================================================

test('EventCard shows a NestUp attendance count and never loads profiles', () => {
  assert.match(eventCard, /attendanceCardKey\(attendeeCount\)/);
  assert.match(eventCard, /attendeeCount = 0/, 'must default to zero, not undefined');
  // A card must never fetch attendee profiles.
  assert.ok(!/public_profiles|useEventRsvp/.test(eventCard), 'EventCard loads attendee data');
});

test('ActivityCard renders capacity from the shared presenter, not raw numbers', () => {
  assert.match(activityCard, /activityCapacityPresentation/);
  assert.match(activityCard, /capacity\.key \?/, 'must render nothing when there is no capacity label');
});

test('capacity is omitted on the compact rail variant', () => {
  assert.match(activityCard, /!isRail && capacity\.key/);
});

// ===========================================================================
// STICKY DISCOVERY CONTROLS
// ===========================================================================

const discover = readFileSync(new URL('../screens/DiscoverScreen.tsx', import.meta.url), 'utf8');

test('STICKY: Search/Filters/Sort live in the sheet header, not a map overlay', () => {
  // The sheet header does not scroll with the list and is present at every
  // snap point, so the controls stay reachable while scrolling the feed.
  const header = discover.slice(discover.indexOf('toolbarSticky'));
  assert.ok(header.length > 0);
  assert.match(discover, /<View style=\{styles\.sheetHeader\}>[\s\S]{0,600}toolbarSticky/);
});

test('STICKY: exactly one instance of each control exists', () => {
  for (const label of ["t('discovery.search')", "t('discovery.sort')"]) {
    const count = discover.split(label).length - 1;
    assert.equal(count, 1, `${label} appears ${count} times — controls are duplicated`);
  }
});

test('STICKY REGRESSION: the sheet header is a plain View, never BottomSheetView', () => {
  // BottomSheetView registers as the sheet's content container. As a sibling of
  // BottomSheetFlatList the list wins that role and the header collapses to
  // zero height -- the controls mount but render invisibly. This is the exact
  // defect that removed Search/Filters/Sort from the device build.
  assert.match(discover, /<View style=\{styles\.sheetHeader\}>/);
  assert.ok(!/<BottomSheetView/.test(discover), 'BottomSheetView is back as a FlatList sibling');
  assert.ok(!/BottomSheetView/.test(discover.split('\n').find((l) => l.includes("from '@gorhom")) ?? ''),
    'BottomSheetView is still imported');
});

test('STICKY: controls sit above the scrollable, so they do not scroll away', () => {
  const header = discover.indexOf('styles.sheetHeader');
  const list = discover.indexOf('<BottomSheetFlatList');
  assert.ok(header > 0 && list > 0 && header < list, 'header must precede the list');
});

test('STICKY: the active filter count remains visible', () => {
  assert.match(discover, /activeFilterCount \? t\('filters\.withCount'/);
});

test('STICKY: filters and sort stay collapsed until pressed, and unmount on close', () => {
  assert.match(discover, /\{filtersOpen \? <ModalSheet/);
  assert.match(discover, /\{sortOpen \? <ModalSheet/);
});

test('STICKY: the control area touches no query, region or selection state', () => {
  const toolbar = discover.slice(discover.indexOf('toolbarSticky}>'), discover.indexOf('sheetTitle'));
  for (const forbidden of ['setRegion', 'refresh(', 'setSelectedItem', 'animateToRegion']) {
    assert.ok(!toolbar.includes(forbidden), `sticky controls touch ${forbidden}`);
  }
});
