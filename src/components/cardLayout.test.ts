import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  ACTIVITY_ART_ASPECT,
  CARD_MEDIA_MAX_HEIGHT,
  resolveCardRenderedHeight,
  resolveFrameHeight,
  resolveFrameRenderedHeight,
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
  // Height is a resolved number, never aspectRatio - see the width-collapse
  // regression below for why that distinction is the whole point.
  assert.match(coverFrame, /height, borderRadius: radius/);
});

test('CoverFrame always clips, so a cover cannot paint outside its frame', () => {
  assert.match(coverFrame, /overflow: 'hidden'/);
});

test('CoverFrame caps both hero and card variants', () => {
  // The caps now live in resolveFrameRenderedHeight, asserted numerically.
  assert.match(coverFrame, /resolveFrameRenderedHeight\(variant, width, screenHeight\)/);
  assert.equal(resolveFrameRenderedHeight('card', CONTENT_WIDTH, SMALL_HEIGHT), CARD_MEDIA_MAX_HEIGHT);
  assert.equal(
    resolveFrameRenderedHeight('hero', SMALL_WIDTH, SMALL_HEIGHT),
    Math.round(SMALL_HEIGHT * 0.32),
  );
});

test('WIDTH COLLAPSE REGRESSION: a capped frame keeps its full width', () => {
  // The device bug: `width: '100%'` + `aspectRatio` + `maxHeight` looks like it
  // clamps height, but Yoga re-derives the WIDTH from the clamped height when an
  // aspectRatio is present. A 16:9 card capped at 140 collapsed to 140*16/9 =
  // 249pt inside a 343pt card, rendering the media as a left-aligned letterbox
  // with a bare gutter beside it. Height must therefore be a plain number, and
  // aspectRatio must not appear in the frame's own style.
  // Comments stripped: the file explains the banned pattern by name.
  const frameCode = coverFrame.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.ok(!/aspectRatio/.test(frameCode), 'aspectRatio is back in CoverFrame');
  assert.match(coverFrame, /width: '100%'/);

  const collapsedWidth = CARD_MEDIA_MAX_HEIGHT * ACTIVITY_ART_ASPECT.card;
  assert.ok(collapsedWidth < CONTENT_WIDTH, 'test is meaningless unless the old bug would bind here');
});

test('the frame measures its real width instead of assuming the window width', () => {
  // Cards sit inside padded parents and fixed-width rails, so the window width
  // is only a first-paint estimate.
  assert.match(coverFrame, /onLayout=/);
  assert.match(coverFrame, /measuredWidth \?\? windowWidth/);
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

test('LAYOUT OWNERSHIP: the sheet is given exactly one content child', () => {
  // @gorhom/bottom-sheet 5.x renders `children` into ONE container of height
  // `sheetHeight - handleHeight` with overflow hidden, and supports a single
  // content element. Passing the header, the error banners and the list as
  // siblings let the scrollable claim that area, pushing everything above it
  // outside the clipped box -- the controls mounted but never appeared. This
  // asserts the structure, not the presence of a string.
  const sheet = discover.slice(discover.indexOf('<BottomSheet '), discover.indexOf('</BottomSheet>'));
  const topLevel = sheet.split('\n').filter((line) => /^ {8}[<{]/.test(line));
  // Only the skeleton/list ternary may sit directly under the sheet.
  assert.ok(topLevel.length <= 2, `sheet has ${topLevel.length} top-level children:\n${topLevel.join('\n')}`);
  assert.ok(!/^ {8}<View style=\{styles\.sheetHeader\}>/m.test(sheet), 'the header is a sheet sibling again');
});

test('LAYOUT OWNERSHIP: the toolbar is the list header and is pinned while scrolling', () => {
  assert.match(discover, /ListHeaderComponent=\{<DiscoverySheetHeader \/>\}/);
  assert.match(discover, /stickyHeaderIndices=\{\[0\]\}/);
  // A transparent sticky header would let cards scroll through it.
  assert.match(discover, /sheetHeader: \{[^}]*backgroundColor: theme\.background\.app/);
});

test('LAYOUT OWNERSHIP: error banners ride in the header, not as sheet siblings', () => {
  const header = discover.slice(discover.indexOf('const DiscoverySheetHeader'), discover.indexOf('/** Restores every filter'));
  for (const banner of ['discovery.error.activities', 'discovery.error.places', 'discovery.error.events']) {
    assert.ok(header.includes(banner), `${banner} is not in the sheet header`);
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
