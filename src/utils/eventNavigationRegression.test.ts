import assert from 'node:assert/strict';
import test from 'node:test';
import type { DiscoveryItem } from '@/types/discovery';
import { handleDiscoveryItemIntent } from '@/utils/discoveryScreenState';

function eventItem(): Extract<DiscoveryItem, { type: 'event' }> {
  return {
    type: 'event',
    id: 'occurrence-34',
    data: {
      occurrence: { id: 'occurrence-34' },
    } as never,
  };
}

test('BUILD 34 REGRESSION: opening an Event never runs native preview commands before navigation', () => {
  const calls: string[] = [];
  const item = eventItem();

  assert.doesNotThrow(() => handleDiscoveryItemIntent(item, 'open', {
    // Models Build 34's MapView/BottomSheet command boundary. Its open path
    // called this first, so a released/unavailable native ref aborted before
    // navigation. This deliberate throw makes that old implementation fail.
    preview: () => { throw new Error('Failed to animateToRegion'); },
    trackOpen: () => calls.push('track'),
    openActivity: () => calls.push('activity'),
    openPlace: () => calls.push('place'),
    openEvent: (opened) => calls.push(`event:${opened.id}`),
  }));

  assert.deepEqual(calls, ['track', 'event:occurrence-34']);
});

test('marker preview still performs the native focus operation without navigating', () => {
  const calls: string[] = [];
  handleDiscoveryItemIntent(eventItem(), 'preview', {
    preview: () => calls.push('preview'),
    trackOpen: () => calls.push('track'),
    openActivity: () => calls.push('activity'),
    openPlace: () => calls.push('place'),
    openEvent: () => calls.push('event'),
  });
  assert.deepEqual(calls, ['preview']);
});
