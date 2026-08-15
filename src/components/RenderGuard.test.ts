import assert from 'node:assert/strict';
import test from 'node:test';
import { RenderGuard } from '@/components/RenderGuard';

test('an optional Event render failure degrades to its supplied fallback', () => {
  const guard = new RenderGuard({ children: 'optional map', fallback: 'event core', resetKey: 'event-1' });
  assert.equal(guard.render(), 'optional map');

  guard.state = RenderGuard.getDerivedStateFromError();
  assert.equal(guard.render(), 'event core');
});

test('an optional Event render failure may be omitted without affecting the parent', () => {
  const guard = new RenderGuard({ children: 'optional image', resetKey: 'event-1' });
  guard.state = RenderGuard.getDerivedStateFromError();
  assert.equal(guard.render(), null);
});
