import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isTelAvivMunicipalEvent } from '@/types/sourceBadge';

const event = (provider: string) => ({ source: { provider } });
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

test('DigiTel event is identified as a Tel Aviv-Yafo municipal event', () => {
  assert.equal(isTelAvivMunicipalEvent(event('tel_aviv_digitel')), true);
});

test('Beit Ariela does not receive the municipality logo', () => {
  assert.equal(isTelAvivMunicipalEvent(event('beit_ariela_libraries')), false);
});

test('Tel Aviv Cinematheque does not receive the municipality logo', () => {
  assert.equal(isTelAvivMunicipalEvent(event('tel_aviv_cinematheque')), false);
});

test('unknown and community providers do not receive the municipality logo', () => {
  assert.equal(isTelAvivMunicipalEvent(event('nestup_community')), false);
  assert.equal(isTelAvivMunicipalEvent(event('')), false);
});

test('EventCard overlays the logo independently of image fallback and preserves navigation', () => {
  const card = read('./EventCard.tsx');
  assert.match(card, /isTelAvivMunicipalEvent\(event\) \? <EventSourceLogo/);
  assert.match(card, /<ContentImage[\s\S]*fallback=\{<CalendarDots/);
  assert.match(card, /onPress=\{\(\) => onPress\(event\)\}/);
});

test('municipality logo keeps its aspect ratio and exposes an accessibility label', () => {
  const logo = read('./EventSourceLogo.tsx');
  assert.match(logo, /resizeMode="contain"/);
  assert.match(logo, /accessibilityLabel=\{accessibilityLabel\}/);
  assert.match(logo, /pointerEvents="none"/);
});
