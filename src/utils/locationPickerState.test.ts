import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  formScrollEnabledDuringMapTouch,
  isMeaningfulRegionChange,
  nextLocationPickerMapGeneration,
  shouldRemountPickerMapForAppState,
  shouldResolveLocationName,
} from './locationPickerState.ts';

// ===========================================================================
// P0 — THE CREATE ACTIVITY MAP MUST BE DRAGGABLE
//
// The reported failure is "the map freezes". It is not frozen: its MapView is
// 220pt tall inside the activity form's ScrollView, and on iOS the parent's
// pan recogniser wins the vertical drag. These tests pin the arbitration.
// ===========================================================================

test('the form stops scrolling while a finger is on the map', () => {
  assert.equal(formScrollEnabledDuringMapTouch(true), false);
  assert.equal(formScrollEnabledDuringMapTouch(false), true);
});

test('releasing the map restores form scrolling — a stuck lock would freeze the FORM', () => {
  let touching = true;
  assert.equal(formScrollEnabledDuringMapTouch(touching), false);
  touching = false; // touch end OR touch cancel
  assert.equal(formScrollEnabledDuringMapTouch(touching), true);
});

// ===========================================================================
// REMOUNT LIFECYCLE — pick a spot, leave, come back, pick a different spot
// ===========================================================================

test('returning to the picker after leaving it gets a fresh native map', () => {
  assert.equal(nextLocationPickerMapGeneration(0, true), 1);
  assert.equal(nextLocationPickerMapGeneration(7, true), 8);
});

test('a focus event WITHOUT an intervening blur does not remount', () => {
  assert.equal(nextLocationPickerMapGeneration(3, false), 3);
});

test('repeated away-and-back cycles keep producing fresh maps', () => {
  let generation = 0;
  for (let cycle = 0; cycle < 10; cycle += 1) {
    generation = nextLocationPickerMapGeneration(generation, true);
  }
  assert.equal(generation, 10, 'ten edit cycles must yield ten distinct map instances');
});

test('foregrounding remounts; other app-state transitions do not', () => {
  assert.equal(shouldRemountPickerMapForAppState('background', 'active'), true);
  assert.equal(shouldRemountPickerMapForAppState('inactive', 'active'), true);
  assert.equal(shouldRemountPickerMapForAppState('active', 'background'), false);
  assert.equal(shouldRemountPickerMapForAppState('active', 'active'), false);
});

// ===========================================================================
// NAME RESOLUTION MUST NOT FIGHT THE GESTURE
// ===========================================================================

test('reverse geocoding waits until the finger is off the map', () => {
  assert.equal(shouldResolveLocationName(true), false);
  assert.equal(shouldResolveLocationName(false), true);
});

test('programmatic and layout region settles are not treated as user pans', () => {
  // No previous region yet: this is the initial layout callback.
  assert.equal(isMeaningfulRegionChange(null, { latitude: 32.08, longitude: 34.78 }), false);
  // Float drift / same spot.
  assert.equal(
    isMeaningfulRegionChange({ latitude: 32.08, longitude: 34.78 }, { latitude: 32.080001, longitude: 34.780001 }),
    false,
  );
});

test('a real drag IS a meaningful change', () => {
  assert.equal(
    isMeaningfulRegionChange({ latitude: 32.08, longitude: 34.78 }, { latitude: 32.09, longitude: 34.79 }),
    true,
  );
});

// ===========================================================================
// THE DISCOVERY MAP IS PHYSICALLY VALIDATED AND MUST NOT BE TOUCHED
// ===========================================================================

test('the picker does not reuse or re-export Discovery map state', () => {
  const source = readFileSync(new URL('./locationPickerState.ts', import.meta.url), 'utf8');
  // An import, not a mention: the module's own comments name
  // discoveryScreenState precisely to record that it is kept separate.
  assert.doesNotMatch(
    source,
    /^\s*import[^\n]*discoveryScreenState/m,
    'the Create Activity picker must not import Discovery map state — Discovery is validated and separate',
  );
});

test('LocationPicker owns its own map generation and never imports Discovery helpers', () => {
  const picker = readFileSync(new URL('../components/LocationPicker.tsx', import.meta.url), 'utf8');
  assert.ok(picker.includes('locationPickerState'), 'picker must use its own lifecycle module');
  assert.ok(
    !picker.includes('nextDiscoveryMapGeneration') && !picker.includes('discoveryMapPointerEvents'),
    'picker must not reach into Discovery map behaviour',
  );
});

test('Discovery still keys its map on its own generation — unchanged', () => {
  const discovery = readFileSync(new URL('../screens/DiscoverScreen.tsx', import.meta.url), 'utf8');
  assert.ok(discovery.includes('key={`discovery-map-${mapGeneration}`}'));
  assert.ok(discovery.includes('nextDiscoveryMapGeneration'));
});

// ===========================================================================
// WIRING — the fix is worthless if the component does not apply it
// ===========================================================================

test('the map is keyed on its generation so it actually remounts', () => {
  const picker = readFileSync(new URL('../components/LocationPicker.tsx', import.meta.url), 'utf8');
  assert.match(picker, /key=\{`activity-location-map-\$\{mapGeneration\}`\}/);
});

test('the picker declares the gestures it needs instead of relying on defaults', () => {
  const picker = readFileSync(new URL('../components/LocationPicker.tsx', import.meta.url), 'utf8');
  for (const prop of ['scrollEnabled', 'zoomEnabled']) {
    assert.ok(picker.includes(prop), `MapView must declare ${prop}`);
  }
});

test('the form hands scroll control to the picker', () => {
  const form = readFileSync(new URL('../components/ActivityForm.tsx', import.meta.url), 'utf8');
  assert.ok(form.includes('onMapTouchChange'), 'form must receive map touch state from the picker');
  assert.match(form, /scrollEnabled=\{/, 'form ScrollView must have controlled scrollEnabled');
});
